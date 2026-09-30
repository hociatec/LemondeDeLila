#include "modules/audio/infrastructure/SoundAssetManifest.h"

#include <algorithm>
#include <cctype>
#include <limits>

#include <nlohmann/json.hpp>

namespace lila::modules::audio::infrastructure
{
namespace
{
bool IsSha256(std::string_view value)
{
    return value.size() == 64 && std::ranges::all_of(value, [](unsigned char character)
    {
        return std::isxdigit(character) != 0;
    });
}

bool IsSafeId(std::string_view value)
{
    return !value.empty() && value.size() <= 128 &&
        std::ranges::all_of(value, [](unsigned char character)
        {
            return std::isalnum(character) != 0 || character == '-' || character == '_';
        });
}

bool IsSupportedUrl(std::string_view value)
{
    return !value.empty() && value.size() <= 2048 &&
        (value.starts_with('/') || value.starts_with("https://") || value.starts_with("http://"));
}
}

std::optional<SoundAssetManifest> ParseSoundAssetManifest(std::string_view payload) noexcept
{
    if (payload.size() > MaximumSoundManifestBytes) return std::nullopt;
    try
    {
        const auto document = nlohmann::json::parse(payload);
        if (!document.is_object()) return std::nullopt;
        const auto sounds = document.find("sounds");
        if (sounds == document.end() || !sounds->is_object() ||
            sounds->size() > MaximumRemoteSoundEntries)
            return std::nullopt;

        SoundAssetManifest result;
        std::size_t totalBytes = 0;
        for (const auto& [id, value] : sounds->items())
        {
            if (!IsSafeId(id) || !value.is_object()) return std::nullopt;
            const auto url = value.find("url");
            const auto sha256 = value.find("sha256");
            const auto bytes = value.find("bytes");
            if (url == value.end() || !url->is_string() ||
                sha256 == value.end() || !sha256->is_string() ||
                bytes == value.end() || !bytes->is_number_unsigned())
                return std::nullopt;
            const auto parsedUrl = url->get<std::string>();
            const auto parsedSha256 = sha256->get<std::string>();
            const auto parsedBytes = bytes->get<std::uint64_t>();
            if (!IsSupportedUrl(parsedUrl) || !IsSha256(parsedSha256) ||
                parsedBytes == 0 || parsedBytes > MaximumRemoteSoundBytes ||
                parsedBytes > MaximumRemoteSoundTotalBytes - totalBytes)
                return std::nullopt;
            totalBytes += static_cast<std::size_t>(parsedBytes);
            result.sounds.emplace(id, RemoteSoundDescriptor{
                std::move(parsedUrl), std::move(parsedSha256),
                static_cast<std::size_t>(parsedBytes)});
        }

        if (const auto disabled = document.find("disabled"); disabled != document.end())
        {
            if (!disabled->is_array() || disabled->size() > MaximumRemoteSoundEntries)
                return std::nullopt;
            for (const auto& id : *disabled)
            {
                if (!id.is_string()) return std::nullopt;
                auto parsedId = id.get<std::string>();
                if (!IsSafeId(parsedId)) return std::nullopt;
                result.disabled.insert(std::move(parsedId));
            }
        }
        return result;
    }
    catch (const nlohmann::json::exception&)
    {
        return std::nullopt;
    }
}
}
