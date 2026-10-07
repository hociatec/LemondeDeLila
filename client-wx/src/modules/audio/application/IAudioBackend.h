#pragma once

#include <optional>
#include <stop_token>

#include "modules/audio/domain/SoundCue.h"

namespace lila::modules::audio::application
{
class IAudioBackend
{
public:
    virtual ~IAudioBackend() = default;

    virtual void Preload(domain::SoundCue cue) = 0;
    virtual void Play(domain::SoundCue cue, float volume) = 0;
    virtual void Preview(std::optional<domain::SoundCue> cue)
    {
        if (cue) Play(*cue, 1.0F);
    }
    virtual void Preview(std::optional<domain::SoundCue> cue, float volume)
    {
        static_cast<void>(volume);
        Preview(cue);
    }
    virtual void SetPreviewVolume(float volume) { static_cast<void>(volume); }
    virtual void TogglePreviewPause() {}
    virtual void SetLoop(std::optional<domain::SoundCue> cue, float volume) = 0;
    virtual void StopAll() = 0;
    // Returns true while the backend has deferred maintenance to finish.
    // The asynchronous wrapper polls it on its audio worker only.
    virtual bool PumpDeferredPlayback() { return false; }
    virtual void RefreshAssets() {}
    // Only I/O is cancellable from another thread; BASS remains on its worker.
    virtual void SetOperationStopToken(std::stop_token token) { static_cast<void>(token); }
    virtual void FinishPlayback() {}
    virtual void ShutdownGracefully() noexcept { Shutdown(); }
    virtual void InterruptPlayback() noexcept = 0;
    virtual void Shutdown() noexcept = 0;
};
}
