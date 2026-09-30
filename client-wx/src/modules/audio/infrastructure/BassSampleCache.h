#pragma once

#include <filesystem>
#include <chrono>
#include <unordered_map>
#include <unordered_set>

#include "modules/audio/domain/SoundCue.h"
#include "modules/audio/infrastructure/AudioCacheLimits.h"
#include "modules/audio/infrastructure/BassApi.h"

namespace lila::modules::audio::infrastructure
{
class BassSampleCache final
{
public:
    explicit BassSampleCache(AudioCacheLimits limits = SampleCacheLimits) : limits_(limits) {}
    [[nodiscard]] HSAMPLE GetOrLoad(domain::SoundCue cue, const std::filesystem::path& path);
    void StopAll() noexcept;
    void Clear() noexcept;
    [[nodiscard]] bool IsPlaying() const noexcept;
    [[nodiscard]] AudioCacheUsage Usage() const noexcept { return {samples_.size(), cachedBytes_}; }

private:
    [[nodiscard]] bool MakeRoom(std::size_t bytes, domain::SoundCue incoming) noexcept;
    void Erase(domain::SoundCue cue) noexcept;

    AudioCacheLimits limits_;
    std::size_t cachedBytes_ = 0;
    std::unordered_map<domain::SoundCue, HSAMPLE> samples_;
    std::unordered_map<domain::SoundCue, std::filesystem::path> paths_;
    std::unordered_map<domain::SoundCue, std::size_t> sizes_;
    std::unordered_map<domain::SoundCue, std::chrono::steady_clock::time_point> lastUsed_;
    std::unordered_map<domain::SoundCue, std::chrono::steady_clock::time_point> failed_;
};
}
