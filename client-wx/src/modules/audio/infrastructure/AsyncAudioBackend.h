#pragma once

#include <memory>
#include <cstddef>

#include "modules/audio/application/IAudioBackend.h"

namespace lila::modules::audio::infrastructure
{
struct AsyncAudioQueueStats final
{
    std::size_t foregroundQueued = 0;
    std::size_t backgroundQueued = 0;
    std::size_t foregroundDropped = 0;
    std::size_t backgroundDropped = 0;
};

class AsyncAudioBackend final : public application::IAudioBackend
{
public:
    explicit AsyncAudioBackend(std::unique_ptr<application::IAudioBackend> backend);
    ~AsyncAudioBackend() override;

    void Preload(domain::SoundCue cue) override;
    void Play(domain::SoundCue cue, float volume) override;
    void Preview(std::optional<domain::SoundCue> cue) override;
    void Preview(std::optional<domain::SoundCue> cue, float volume) override;
    void SetPreviewVolume(float volume) override;
    void TogglePreviewPause() override;
    void SetLoop(std::optional<domain::SoundCue> cue, float volume) override;
    void StopAll() override;
    void RefreshAssets() override;
    void ShutdownGracefully() noexcept override;
    void InterruptPlayback() noexcept override;
    void Shutdown() noexcept override;
    [[nodiscard]] AsyncAudioQueueStats Stats() const;

private:
    class Impl;
    std::unique_ptr<Impl> impl_;
};
}
