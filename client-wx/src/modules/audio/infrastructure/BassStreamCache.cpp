#include "modules/audio/infrastructure/BassStreamCache.h"

#include <algorithm>
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
    paths_.clear();
    sizes_.clear();
    lastUsed_.clear();
    failed_.clear();
    cachedBytes_ = 0;
}

void BassStreamCache::ClearInactive() noexcept
{
    for (auto stream = streams_.begin(); stream != streams_.end();)
    {
        if (current_.has_value() && stream->first == *current_)
        {
            ++stream;
            continue;
        }
        const auto cue = stream->first;
        ++stream;
        Erase(cue);
    }
    failed_.clear();
}

HSTREAM BassStreamCache::GetOrLoad(domain::SoundCue cue, const std::filesystem::path& path)
{
    if (path.empty()) return 0;
    if (paths_[cue] != path)
    {
        if (current_ == cue) Stop();
        if (const auto old = streams_.find(cue); old != streams_.end())
            Erase(cue);
        failed_.erase(cue);
        paths_[cue] = path;
    }
    if (const auto cached = streams_.find(cue); cached != streams_.end())
    {
        lastUsed_[cue] = std::chrono::steady_clock::now();
        return cached->second;
    }
    if (failed_.contains(cue) && std::chrono::steady_clock::now() < failed_.at(cue))
    {
        return 0;
    }
    std::error_code sizeError;
    const auto sourceBytesRaw = std::filesystem::file_size(path, sizeError);
    if (sizeError || sourceBytesRaw > limits_.maximumBytesPerEntry)
    {
        failed_[cue] = std::chrono::steady_clock::now() + std::chrono::seconds(5);
        lila::shared::logging::LogWarning(
            "Audio", "Audio stream exceeds the configured cache budget or is unavailable.");
        return 0;
    }
    const auto sourceBytes = static_cast<std::size_t>(sourceBytesRaw);
    if (!MakeRoom(sourceBytes, cue))
    {
        failed_[cue] = std::chrono::steady_clock::now() + std::chrono::seconds(5);
        return 0;
    }
    const HSTREAM stream = BASS_StreamCreateFile(
        FALSE, path.c_str(), 0, 0, BASS_UNICODE | BASS_SAMPLE_LOOP | BASS_STREAM_PRESCAN);
    if (stream == 0)
    {
        failed_[cue] = std::chrono::steady_clock::now() + std::chrono::seconds(5);
        lila::shared::logging::LogWarning(
            "Audio", "BASS could not load " + path.string() +
                " (error " + std::to_string(BASS_ErrorGetCode()) + ").");
        return 0;
    }
    streams_.emplace(cue, stream);
    sizes_[cue] = sourceBytes;
    cachedBytes_ += sourceBytes;
    lastUsed_[cue] = std::chrono::steady_clock::now();
    return stream;
}

bool BassStreamCache::MakeRoom(std::size_t bytes, domain::SoundCue incoming) noexcept
{
    while (streams_.size() >= limits_.maximumEntries ||
        bytes > limits_.maximumBytes - std::min(cachedBytes_, limits_.maximumBytes))
    {
        auto oldest = lastUsed_.end();
        for (auto candidate = lastUsed_.begin(); candidate != lastUsed_.end(); ++candidate)
        {
            if (candidate->first == incoming || current_ == candidate->first) continue;
            if (oldest == lastUsed_.end() || candidate->second < oldest->second)
                oldest = candidate;
        }
        if (oldest == lastUsed_.end()) return false;
        Erase(oldest->first);
    }
    return true;
}

void BassStreamCache::Erase(domain::SoundCue cue) noexcept
{
    if (const auto stream = streams_.find(cue); stream != streams_.end())
    {
        BASS_StreamFree(stream->second);
        streams_.erase(stream);
    }
    if (const auto size = sizes_.find(cue); size != sizes_.end())
    {
        cachedBytes_ -= std::min(cachedBytes_, size->second);
        sizes_.erase(size);
    }
    paths_.erase(cue);
    lastUsed_.erase(cue);
}
}
