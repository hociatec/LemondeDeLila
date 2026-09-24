#pragma once

#include <filesystem>
#include <chrono>
#include <unordered_map>
#include <unordered_set>

#include "modules/audio/domain/SoundCue.h"
#include "modules/audio/infrastructure/BassApi.h"

namespace lila::modules::audio::infrastructure
{
class BassSampleCache final
{
public:
    [[nodiscard]] HSAMPLE GetOrLoad(domain::SoundCue cue, const std::filesystem::path& path);
    void StopAll() noexcept;
    void Clear() noexcept;
    [[nodiscard]] bool IsPlaying() const noexcept;

private:
    std::unordered_map<domain::SoundCue, HSAMPLE> samples_;
    std::unordered_map<domain::SoundCue, std::filesystem::path> paths_;
    std::unordered_map<domain::SoundCue, std::chrono::steady_clock::time_point> failed_;
};
}
