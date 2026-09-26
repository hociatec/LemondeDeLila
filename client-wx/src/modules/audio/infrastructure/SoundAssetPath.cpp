#include "modules/audio/infrastructure/SoundAssetPath.h"

#include "modules/audio/infrastructure/LocalSoundManifest.h"
#include "modules/audio/infrastructure/SoundAssetCacheCleanup.h"

#include <array>
#include <cctype>
#include <fstream>
#include <iomanip>
#include <iterator>
#include <sstream>
#include <vector>

#include <nlohmann/json.hpp>

#include "modules/audio/domain/SoundCatalog.h"
#include "shared/config/domain/AppConfig.h"
#include "shared/logging/application/Logger.h"
#include "shared/network/domain/UrlUtils.h"
#include "shared/network/infrastructure/http/WsTicketTransport.h"

#ifdef _WIN32
#include <windows.h>
#include <bcrypt.h>
#endif

namespace lila::modules::audio::infrastructure
{
namespace
{
std::filesystem::path ExecutableDirectory()
{
#ifdef _WIN32
    std::wstring path(32768, L'\0');
    const DWORD length = GetModuleFileNameW(nullptr, path.data(), static_cast<DWORD>(path.size()));
    if (length == 0 || length >= path.size())
    {
        return {};
    }
    path.resize(length);
    return std::filesystem::path(path).parent_path();
#else
    return {};
#endif
}

std::filesystem::path SoundCacheDirectory()
{
#ifdef _WIN32
    std::wstring value(32768, L'\0');
    const DWORD length = GetEnvironmentVariableW(
        L"LOCALAPPDATA", value.data(), static_cast<DWORD>(value.size()));
    if (length > 0 && length < value.size())
    {
        value.resize(length);
        return std::filesystem::path(value) / L"LeMondeDeLila" / L"sounds";
    }
#endif
    return {};
}

#ifdef _WIN32
std::string Sha256(const std::string& content)
{
    BCRYPT_ALG_HANDLE algorithm = nullptr;
    BCRYPT_HASH_HANDLE hash = nullptr;
    DWORD objectSize = 0;
    DWORD resultSize = 0;
    std::vector<unsigned char> object;
    std::array<unsigned char, 32> digest{};
    const auto cleanup = [&]()
    {
        if (hash) BCryptDestroyHash(hash);
        if (algorithm) BCryptCloseAlgorithmProvider(algorithm, 0);
    };
    if (BCryptOpenAlgorithmProvider(&algorithm, BCRYPT_SHA256_ALGORITHM, nullptr, 0) != 0 ||
        BCryptGetProperty(algorithm, BCRYPT_OBJECT_LENGTH,
            reinterpret_cast<PUCHAR>(&objectSize), sizeof(objectSize), &resultSize, 0) != 0)
    {
        cleanup(); return {};
    }
    object.resize(objectSize);
    if (BCryptCreateHash(algorithm, &hash, object.data(), objectSize, nullptr, 0, 0) != 0 ||
        BCryptHashData(hash, reinterpret_cast<PUCHAR>(const_cast<char*>(content.data())),
            static_cast<ULONG>(content.size()), 0) != 0 ||
        BCryptFinishHash(hash, digest.data(), static_cast<ULONG>(digest.size()), 0) != 0)
    {
        cleanup(); return {};
    }
    cleanup();
    std::ostringstream output;
    output << std::hex << std::setfill('0');
    for (const auto byte : digest) output << std::setw(2) << static_cast<int>(byte);
    return output.str();
}
#endif
}

SoundAssetPathResolver::SoundAssetPathResolver()
    : soundDirectory_(ExecutableDirectory() / L"resources" / L"sounds"),
      cacheDirectory_(SoundCacheDirectory())
{
}

std::filesystem::path SoundAssetPathResolver::Resolve(domain::SoundCue cue)
{
    LoadRemoteManifest();
    const auto* descriptor = domain::FindSoundDescriptor(cue);
    std::string soundId = descriptor == nullptr ? std::string{} : std::string(descriptor->key);
    if (!soundId.empty()) soundId.front() = static_cast<char>(std::toupper(soundId.front()));
    if (disabledSounds_.contains(soundId)) return {};
    if (const auto found = remoteSounds_.find(soundId); found != remoteSounds_.end())
    {
        const auto remote = ResolveRemote(soundId, found->second);
        if (!remote.empty()) return remote;
    }
    const auto file = GetLocalSoundFile(cue);
    return file.empty()
        ? std::filesystem::path{}
        : soundDirectory_ / file;
}

std::filesystem::path SoundAssetPathResolver::ResolvePreview(domain::SoundCue cue)
{
    Invalidate();
    LoadRemoteManifest();
    const auto* descriptor = domain::FindSoundDescriptor(cue);
    if (descriptor == nullptr) return {};
    std::string soundId(descriptor->key);
    if (!soundId.empty()) soundId.front() = static_cast<char>(std::toupper(soundId.front()));
    if (const auto found = remoteSounds_.find(soundId); found != remoteSounds_.end())
        return ResolveRemote(soundId, found->second);
    const auto file = GetLocalSoundFile(cue);
    return file.empty() ? std::filesystem::path{} : soundDirectory_ / file;
}

void SoundAssetPathResolver::LoadRemoteManifest()
{
    if (manifestLoaded_ || std::chrono::steady_clock::now() < nextManifestAttempt_) return;
    nextManifestAttempt_ = std::chrono::steady_clock::now() + std::chrono::seconds(10);
#ifdef _WIN32
    try
    {
        const auto origin = lila::shared::network::WebSocketOriginToHttp(
            lila::shared::config::AppConfig::ResolveBackendApiWs());
        const auto raw = lila::shared::network::http::RequestWsTicketResponse(
            origin + "/api/sounds/manifest", {});
        const auto manifest = nlohmann::json::parse(raw);
        if (!manifest.is_object() || !manifest.contains("sounds") || !manifest["sounds"].is_object())
            return;
        remoteSounds_.clear();
        disabledSounds_.clear();
        if (const auto disabled = manifest.find("disabled");
            disabled != manifest.end() && disabled->is_array())
            for (const auto& id : *disabled)
                if (id.is_string()) disabledSounds_.insert(id.get<std::string>());
        const auto sounds = manifest.find("sounds");
        if (sounds == manifest.end() || !sounds->is_object()) return;
        for (const auto& [id, value] : sounds->items())
        {
            if (!value.is_object()) continue;
            const auto url = value.value("url", std::string{});
            const auto sha = value.value("sha256", std::string{});
            const auto bytes = value.value("bytes", std::size_t{});
            if (!url.empty() && sha.size() == 64 && bytes <= 250U * 1024U * 1024U)
                remoteSounds_[id] = {url, sha, bytes};
        }
        std::unordered_map<std::string, std::string> currentHashes;
        for (const auto& [id, sound] : remoteSounds_) currentHashes[id] = sound.sha256;
        CleanupRemoteSoundCache(cacheDirectory_, currentHashes);
        manifestLoaded_ = true;
    }
    catch (const std::exception& error)
    {
        lila::shared::logging::LogWarning(
            "Audio", "Manifest audio distant indisponible: " + std::string(error.what()));
    }
#endif
}

void SoundAssetPathResolver::Invalidate()
{
    manifestLoaded_ = false;
    nextManifestAttempt_ = {};
    verifiedAssets_.clear();
}

std::filesystem::path SoundAssetPathResolver::ResolveRemote(
    const std::string& soundId,
    const RemoteSound& sound)
{
#ifdef _WIN32
    try
    {
        if (cacheDirectory_.empty()) return {};
        const auto directory = cacheDirectory_ / soundId;
        const auto target = directory / (sound.sha256 + ".wav");
        if (std::filesystem::is_regular_file(target) &&
            std::filesystem::file_size(target) == sound.bytes)
        {
            if (verifiedAssets_.contains(soundId + sound.sha256)) return target;
            std::ifstream input(target, std::ios::binary);
            const std::string cached((std::istreambuf_iterator<char>(input)), {});
            if (cached.size() == sound.bytes && Sha256(cached) == sound.sha256)
            {
                verifiedAssets_.insert(soundId + sound.sha256);
                return target;
            }
        }
        auto url = sound.url;
        if (!url.starts_with("https://") && !url.starts_with("http://"))
            url = lila::shared::network::WebSocketOriginToHttp(
                lila::shared::config::AppConfig::ResolveBackendApiWs()) + url;
        const auto content = lila::shared::network::http::RequestWsTicketResponse(
            url, {}, sound.bytes);
        if (content.size() != sound.bytes || Sha256(content) != sound.sha256) return {};
        std::filesystem::create_directories(directory);
        auto temporary = target;
        temporary += L".tmp";
        std::filesystem::remove(temporary);
        std::ofstream output(temporary, std::ios::binary | std::ios::trunc);
        output.write(content.data(), static_cast<std::streamsize>(content.size()));
        output.close();
        if (!output) { std::filesystem::remove(temporary); return {}; }
        std::filesystem::remove(target);
        std::filesystem::rename(temporary, target);
        verifiedAssets_.insert(soundId + sound.sha256);
        return target;
    }
    catch (const std::exception& error)
    {
        lila::shared::logging::LogWarning(
            "Audio", "Son distant " + soundId + " indisponible: " + error.what());
    }
#else
    (void)soundId; (void)sound;
#endif
    return {};
}
}
