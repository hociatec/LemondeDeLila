#include "modules/audio/infrastructure/BassStreamCache.h"

#include <string>

#include "shared/logging/application/Logger.h"

namespace lila::modules::audio::infrastructure
{
void BassStreamCache::Preload(domain::SoundCue cue, const std::filesystem::path& path)
{
    static_cast<void>(GetOrLoad(cue, path));
}

void BassStreamCache::StartOrUpdate(
    domain::SoundCue cue,
    const std::filesystem::path& path,
    float volume,
    const std::atomic_bool& cancelled)
{
    const HSTREAM stream = GetOrLoad(cue, path);
    if (stream == 0 || cancelled.load(std::memory_order_acquire))
    {
        Stop();
        return;
    }
    if (current_.has_value() && *current_ == cue)
    {
        BASS_ChannelSetAttribute(stream, BASS_ATTRIB_VOL, volume);
        if (BASS_ChannelIsActive(stream) != BASS_ACTIVE_PLAYING)
        {
            BASS_ChannelPlay(stream, FALSE);
        }
        return;
    }

    Stop();
    BASS_ChannelSetPosition(stream, 0, BASS_POS_BYTE);
    if (BASS_ChannelSetAttribute(stream, BASS_ATTRIB_VOL, volume) &&
        BASS_ChannelPlay(stream, FALSE))
    {
        current_ = cue;
    }
}

void BassStreamCache::Stop() noexcept
{
    if (!current_.has_value())
    {
        return;
    }
    if (const auto stream = streams_.find(*current_); stream != streams_.end())
    {
        BASS_ChannelStop(stream->second);
    }
    current_.reset();
}

void BassStreamCache::Clear() noexcept
{
    Stop();
    for (const auto& [cue, stream] : streams_)
    {
        static_cast<void>(cue);
        BASS_StreamFree(stream);
    }
    streams_.clear();
    failed_.clear();
}

HSTREAM BassStreamCache::GetOrLoad(domain::SoundCue cue, const std::filesystem::path& path)
{
    if (const auto cached = streams_.find(cue); cached != streams_.end())
    {
        return cached->second;
    }
    if (path.empty() || failed_.contains(cue))
    {
        return 0;
    }
    const HSTREAM stream = BASS_StreamCreateFile(
        FALSE, path.c_str(), 0, 0, BASS_UNICODE | BASS_SAMPLE_LOOP | BASS_STREAM_PRESCAN);
    if (stream == 0)
    {
        failed_.insert(cue);
        lila::shared::logging::LogWarning(
            "Audio", "BASS could not load " + path.string() +
                " (error " + std::to_string(BASS_ErrorGetCode()) + ").");
        return 0;
    }
    streams_.emplace(cue, stream);
    return stream;
}
}
