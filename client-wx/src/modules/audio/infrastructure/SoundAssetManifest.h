#pragma once

#include <cstddef>
#include <optional>
#include <string>
#include <string_view>
#include <unordered_map>
#include <unordered_set>

namespace lila::modules::audio::infrastructure
{
struct RemoteSoundDescriptor final
{
    std::string url;
    std::string sha256;
    std::size_t bytes = 0;
};

struct SoundAssetManifest final
{
    std::unordered_map<std::string, RemoteSoundDescriptor> sounds;
    std::unordered_set<std::string> disabled;
};

inline constexpr std::size_t MaximumSoundManifestBytes = 1024U * 1024U;
inline constexpr std::size_t MaximumRemoteSoundBytes = 32U * 1024U * 1024U;
inline constexpr std::size_t MaximumRemoteSoundTotalBytes = 128U * 1024U * 1024U;
inline constexpr std::size_t MaximumRemoteSoundEntries = 256;

[[nodiscard]] std::optional<SoundAssetManifest> ParseSoundAssetManifest(
    std::string_view payload) noexcept;
}
