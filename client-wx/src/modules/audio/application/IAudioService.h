#pragma once

#include "modules/audio/domain/AudioBackground.h"
#include "modules/audio/domain/SoundCue.h"
#include <string_view>
#include <optional>

namespace lila::modules::audio::application
{
class IAudioService
{
public:
    virtual ~IAudioService() = default;

    virtual void Play(domain::SoundCue cue) = 0;
    // Explicit audition, independent of automatic playback preferences.
    virtual void Preview(std::optional<domain::SoundCue> cue)
    {
        if (cue) Play(*cue);
    }
    virtual void StartLoop(domain::SoundCue cue) = 0;
    virtual void StopLoop() = 0;
    virtual void StartTableAmbience(std::string_view soundId) = 0;
    virtual void SetTableAmbienceVolume(int volume) = 0;
    virtual void SetBackground(domain::AudioBackground background) = 0;
    virtual void StopAll() = 0;
    virtual void RefreshAssets() {}
    virtual void ShutdownGracefully() { ShutdownImmediately(); }
    virtual void ShutdownImmediately() = 0;
};
}
