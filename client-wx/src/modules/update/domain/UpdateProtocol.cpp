#include "modules/update/domain/UpdateProtocol.h"

#include <nlohmann/json.hpp>

#include <algorithm>
#include <cctype>
#include <regex>
#include <stdexcept>

namespace lila::modules::update
{
using json = nlohmann::json;

std::array<int, 4> ParseUpdateVersion(const std::string& version)
{
    static const std::regex pattern(
        "^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(?:\\.(0|[1-9][0-9]*))?$");
    std::smatch match;
    if (!std::regex_match(version, match, pattern)) {
        throw std::runtime_error("Invalid update version.");
    }
    std::array<int, 4> result{};
    for (std::size_t index = 0; index < result.size(); ++index) {
        if (index + 1 >= match.size() || !match[index + 1].matched) continue;
        const auto value = std::stoull(match[index + 1].str());
        if (value > 999'999) throw std::runtime_error("Update version component is too large.");
        result[index] = static_cast<int>(value);
    }
    return result;
}

bool IsUpdateNewer(const std::string& candidate, const std::string& current)
{
    if (current.empty()) return true;
    return ParseUpdateVersion(candidate) > ParseUpdateVersion(current);
}

bool IsSafeReleaseId(const std::string& value)
{
    static const std::regex pattern("^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$");
    return std::regex_match(value, pattern) && value.find("..") == std::string::npos;
}

bool IsSafeArchivePath(std::string value)
{
    if (value.empty() || value.front() == '/' || value.front() == '\\' ||
        value.find('\0') != std::string::npos || value.find(':') != std::string::npos) {
        return false;
    }
    std::replace(value.begin(), value.end(), '\\', '/');
    std::size_t start = 0;
    while (start < value.size()) {
        const auto end = value.find('/', start);
        const auto length = (end == std::string::npos ? value.size() : end) - start;
        const auto segment = value.substr(start, length);
        if (segment.empty() || segment == "." || segment == "..") return false;
        if (end == std::string::npos) break;
        start = end + 1;
    }
    return true;
}

std::string BuildStagedUpdateArchiveFileName(const std::string& releaseId)
{
    if (!IsSafeReleaseId(releaseId)) {
        throw std::runtime_error("Unsafe update release identifier.");
    }
    // Keep an explicit ZIP suffix so diagnostics and recovery can identify it.
    return releaseId + ".download.zip";
}

UpdateManifest ParseUpdateManifest(const std::string& raw)
{
    const auto value = json::parse(raw);
    if (value.value("schemaVersion", 0) != 2 ||
        value.value("product", "") != "client-wx" ||
        value.value("platform", "") != "windows" ||
        value.value("architecture", "") != "x64" ||
        value.value("channel", "") != "stable") {
        throw std::runtime_error("Update manifest targets another product.");
    }
    const auto& artifact = value.at("artifact");
    UpdateManifest result;
    result.releaseId = value.value("releaseId", "");
    result.version = value.value("version", "");
    result.sequence = value.value("sequence", std::uint64_t{});
    result.publishedAt = value.value("publishedAt", "");
    result.mandatoryAt = value.contains("mandatoryAt") && value["mandatoryAt"].is_string()
        ? value["mandatoryAt"].get<std::string>() : "";
    result.minimumVersion = value.contains("minimumVersion") && value["minimumVersion"].is_string()
        ? value["minimumVersion"].get<std::string>() : "";
    result.url = artifact.value("url", "");
    result.size = artifact.value("size", std::uint64_t{});
    result.sha256 = artifact.value("sha256", "");
    result.signature = artifact.value("signature", "");
    static_cast<void>(ParseUpdateVersion(result.version));
    if (!result.minimumVersion.empty()) {
        static_cast<void>(ParseUpdateVersion(result.minimumVersion));
    }
    if (!IsSafeReleaseId(result.releaseId) || result.sequence == 0 ||
        result.publishedAt.empty() || result.url.empty() || result.size == 0 ||
        result.size > 2ULL * 1024ULL * 1024ULL * 1024ULL ||
        result.sha256.size() != 64 || result.signature.empty() ||
        !std::all_of(result.sha256.begin(), result.sha256.end(), [](unsigned char character) {
            return std::isdigit(character) != 0 ||
                (character >= static_cast<unsigned char>('a') &&
                    character <= static_cast<unsigned char>('f'));
        })) {
        throw std::runtime_error("Update manifest is incomplete.");
    }
    if (artifact.value("signatureAlgorithm", "") != "rsa-pkcs1-sha256") {
        throw std::runtime_error("Unsupported update signature algorithm.");
    }
    return result;
}

std::string CanonicalUpdateSignature(const UpdateManifest& manifest)
{
    return "lila-client-wx-manifest-v2\n"
        "product=client-wx\n"
        "platform=windows\n"
        "architecture=x64\n"
        "channel=stable\n"
        "releaseId=" + manifest.releaseId +
        "\nversion=" + manifest.version +
        "\nsequence=" + std::to_string(manifest.sequence) +
        "\npublishedAt=" + manifest.publishedAt +
        "\nmandatoryAt=" + (manifest.mandatoryAt.empty() ? "-" : manifest.mandatoryAt) +
        "\nminimumVersion=" + (manifest.minimumVersion.empty() ? "-" : manifest.minimumVersion) +
        "\nartifactSize=" + std::to_string(manifest.size) +
        "\nartifactSha256=" + manifest.sha256;
}
}
