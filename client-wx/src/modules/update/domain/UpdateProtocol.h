#pragma once

#include <array>
#include <cstdint>
#include <string>

namespace lila::modules::update
{
struct UpdateManifest
{
    std::string releaseId;
    std::string version;
    std::uint64_t sequence = 0;
    std::string publishedAt;
    std::string mandatoryAt;
    std::string minimumVersion;
    std::string url;
    std::uint64_t size = 0;
    std::string sha256;
    std::string signature;
};

[[nodiscard]] std::array<int, 4> ParseUpdateVersion(const std::string& version);
[[nodiscard]] bool IsUpdateNewer(const std::string& candidate, const std::string& current);
[[nodiscard]] bool IsSafeReleaseId(const std::string& value);
[[nodiscard]] std::string BuildStagedUpdateArchiveFileName(const std::string& releaseId);
[[nodiscard]] UpdateManifest ParseUpdateManifest(const std::string& raw);
[[nodiscard]] std::string CanonicalUpdateSignature(const UpdateManifest& manifest);
}
