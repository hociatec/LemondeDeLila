#include "modules/audio/infrastructure/BassSampleCache.h"

#include <string>

#include "shared/logging/application/Logger.h"

namespace lila::modules::audio::infrastructure
{
HSAMPLE BassSampleCache::GetOrLoad(domain::SoundCue cue, const std::filesystem::path& path)
{
    if (path.empty()) return 0;
    if (paths_[cue] != path)
    {
        if (const auto old = samples_.find(cue); old != samples_.end())
        {
            BASS_SampleFree(old->second);
            samples_.erase(old);
        }
        failed_.erase(cue);
        paths_[cue] = path;
    }
    if (const auto cached = samples_.find(cue); cached != samples_.end())
    {
        return cached->second;
    }
    if (failed_.contains(cue) && std::chrono::steady_clock::now() < failed_.at(cue))
    {
        return 0;
    }

    const HSAMPLE sample = BASS_SampleLoad(
        FALSE, path.c_str(), 0, 0, 8, BASS_UNICODE | BASS_SAMPLE_OVER_POS);
    if (sample == 0)
    {
        failed_[cue] = std::chrono::steady_clock::now() + std::chrono::seconds(5);
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
    paths_.clear();
    failed_.clear();
}

bool BassSampleCache::IsPlaying() const noexcept
{
    for (const auto& [cue, sample] : samples_)
    {
        (void)cue;
        HCHANNEL channels[8]{};
        const auto count = BASS_SampleGetChannels(sample, channels);
        if (count == static_cast<DWORD>(-1)) continue;
        for (DWORD index = 0; index < count && index < 8; ++index)
            if (BASS_ChannelIsActive(channels[index]) == BASS_ACTIVE_PLAYING) return true;
    }
    return false;
}
}
