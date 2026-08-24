#pragma once

#include <optional>

#include "modules/audio/domain/SoundCue.h"

namespace lila::modules::audio::application
{
class IAudioBackend
{
public:
    virtual ~IAudioBackend() = default;

    virtual void Preload(domain::SoundCue cue) = 0;
    virtual void Play(domain::SoundCue cue, float volume) = 0;
    virtual void SetLoop(std::optional<domain::SoundCue> cue, float volume) = 0;
    virtual void StopAll() = 0;
    virtual void InterruptPlayback() noexcept = 0;
    virtual void Shutdown() noexcept = 0;
};
}
