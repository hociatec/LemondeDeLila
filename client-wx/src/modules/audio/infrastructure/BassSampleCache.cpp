#include "modules/audio/infrastructure/BassSampleCache.h"

#include <algorithm>
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
            Erase(cue);
        failed_.erase(cue);
        paths_[cue] = path;
    }
    if (const auto cached = samples_.find(cue); cached != samples_.end())
    {
        lastUsed_[cue] = std::chrono::steady_clock::now();
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
    BASS_SAMPLE information{};
    if (!BASS_SampleGetInfo(sample, &information) ||
        information.length > limits_.maximumBytesPerEntry ||
        !MakeRoom(information.length, cue))
    {
        BASS_SampleFree(sample);
        failed_[cue] = std::chrono::steady_clock::now() + std::chrono::seconds(5);
        lila::shared::logging::LogWarning(
            "Audio", "Decoded sample exceeds the configured audio cache budget.");
        return 0;
    }
    samples_.emplace(cue, sample);
    sizes_[cue] = information.length;
    cachedBytes_ += information.length;
    lastUsed_[cue] = std::chrono::steady_clock::now();
    return sample;
}

bool BassSampleCache::MakeRoom(std::size_t bytes, domain::SoundCue incoming) noexcept
{
    while (samples_.size() >= limits_.maximumEntries ||
        bytes > limits_.maximumBytes - std::min(cachedBytes_, limits_.maximumBytes))
    {
        auto oldest = lastUsed_.end();
        for (auto candidate = lastUsed_.begin(); candidate != lastUsed_.end(); ++candidate)
        {
            if (candidate->first == incoming) continue;
            if (oldest == lastUsed_.end() || candidate->second < oldest->second)
                oldest = candidate;
        }
        if (oldest == lastUsed_.end()) return false;
        Erase(oldest->first);
    }
    return true;
}

void BassSampleCache::Erase(domain::SoundCue cue) noexcept
{
    if (const auto sample = samples_.find(cue); sample != samples_.end())
    {
        BASS_SampleFree(sample->second);
        samples_.erase(sample);
    }
    if (const auto size = sizes_.find(cue); size != sizes_.end())
    {
        cachedBytes_ -= std::min(cachedBytes_, size->second);
        sizes_.erase(size);
    }
    lastUsed_.erase(cue);
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
    sizes_.clear();
    lastUsed_.clear();
    failed_.clear();
    cachedBytes_ = 0;
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
