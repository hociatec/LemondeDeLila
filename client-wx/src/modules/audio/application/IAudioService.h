#pragma once

#include "modules/audio/domain/AudioBackground.h"
#include "modules/audio/domain/SoundCue.h"
#include <string_view>

namespace lila::modules::audio::application
{
class IAudioService
{
public:
    virtual ~IAudioService() = default;

    virtual void Play(domain::SoundCue cue) = 0;
    virtual void StartLoop(domain::SoundCue cue) = 0;
    virtual void StopLoop() = 0;
    virtual void StartTableAmbience(std::string_view soundId) = 0;
    virtual void SetTableAmbienceVolume(int volume) = 0;
    virtual void SetBackground(domain::AudioBackground background) = 0;
    virtual void StopAll() = 0;
    virtual void ShutdownImmediately() = 0;
};
}
