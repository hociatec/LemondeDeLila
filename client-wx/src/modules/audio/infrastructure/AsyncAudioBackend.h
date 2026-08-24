#pragma once

#include <memory>

#include "modules/audio/application/IAudioBackend.h"

namespace lila::modules::audio::infrastructure
{
class AsyncAudioBackend final : public application::IAudioBackend
{
public:
    explicit AsyncAudioBackend(std::unique_ptr<application::IAudioBackend> backend);
    ~AsyncAudioBackend() override;

    void Preload(domain::SoundCue cue) override;
    void Play(domain::SoundCue cue, float volume) override;
    void SetLoop(std::optional<domain::SoundCue> cue, float volume) override;
    void StopAll() override;
    void InterruptPlayback() noexcept override;
    void Shutdown() noexcept override;

private:
    class Impl;
    std::unique_ptr<Impl> impl_;
};
}
