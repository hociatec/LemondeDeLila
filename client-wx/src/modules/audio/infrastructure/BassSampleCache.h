#pragma once

#include <filesystem>
#include <unordered_map>
#include <unordered_set>

#include <bass.h>

#include "modules/audio/domain/SoundCue.h"

namespace lila::modules::audio::infrastructure
{
class BassSampleCache final
{
public:
    [[nodiscard]] HSAMPLE GetOrLoad(domain::SoundCue cue, const std::filesystem::path& path);
    void StopAll() noexcept;
    void Clear() noexcept;

private:
    std::unordered_map<domain::SoundCue, HSAMPLE> samples_;
    std::unordered_set<domain::SoundCue> failed_;
};
}
