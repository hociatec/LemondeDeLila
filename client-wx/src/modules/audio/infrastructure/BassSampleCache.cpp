#include "modules/audio/infrastructure/BassSampleCache.h"

#include <string>

#include "shared/logging/application/Logger.h"

namespace lila::modules::audio::infrastructure
{
HSAMPLE BassSampleCache::GetOrLoad(domain::SoundCue cue, const std::filesystem::path& path)
{
    if (const auto cached = samples_.find(cue); cached != samples_.end())
    {
        return cached->second;
    }
    if (path.empty() || failed_.contains(cue))
    {
        return 0;
    }

    const HSAMPLE sample = BASS_SampleLoad(
        FALSE, path.c_str(), 0, 0, 8, BASS_UNICODE | BASS_SAMPLE_OVER_POS);
    if (sample == 0)
    {
        failed_.insert(cue);
        lila::shared::logging::LogWarning(
            "Audio", "BASS could not load " + path.string() +
                " (error " + std::to_string(BASS_ErrorGetCode()) + ").");
        return 0;
    }
    samples_.emplace(cue, sample);
    return sample;
}

void BassSampleCache::StopAll() noexcept
{
    for (const auto& [cue, sample] : samples_)
    {
        static_cast<void>(cue);
        BASS_SampleStop(sample);
    }
}

void BassSampleCache::Clear() noexcept
{
    for (const auto& [cue, sample] : samples_)
    {
        static_cast<void>(cue);
        BASS_SampleFree(sample);
    }
    samples_.clear();
    failed_.clear();
}
}
