#pragma once

#include <array>
#include <cstdint>
#include <string>

namespace lila::modules::update
{
inline constexpr std::uint64_t MaximumUpdateManifestBytes = 1024U * 1024U;
inline constexpr std::uint64_t MaximumArchiveEntries = 20'000;
inline constexpr std::uint64_t MaximumExtractedBytes = 8ULL * 1024ULL * 1024ULL * 1024ULL;
inline constexpr std::uint64_t MaximumExtractedEntryBytes = 1024ULL * 1024ULL * 1024ULL;

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
[[nodiscard]] bool IsSafeArchivePath(std::string value);
[[nodiscard]] bool IsArchiveDirectoryLayoutSafe(
    std::uint64_t archiveBytes,
    std::uint64_t directoryOffset,
    std::uint64_t directoryBytes,
    std::uint64_t entries) noexcept;
[[nodiscard]] bool IsArchiveExpansionSafe(
    std::uint64_t compressedBytes,
    std::uint64_t extractedBytes,
    std::uint64_t entries) noexcept;
[[nodiscard]] bool IsUpdateSequenceAllowed(
    std::uint64_t candidate,
    std::uint64_t highestAccepted) noexcept;
[[nodiscard]] std::string BuildStagedUpdateArchiveFileName(const std::string& releaseId);
[[nodiscard]] UpdateManifest ParseUpdateManifest(const std::string& raw);
[[nodiscard]] std::string CanonicalUpdateSignature(const UpdateManifest& manifest);
}
