#pragma once

#include <atomic>

#include "modules/audio/application/IAudioService.h"

namespace lila::modules::audio::application
{
class IAudioBackend;
class IAudioSettingsProvider;

class AudioService final : public IAudioService
{
public:
    AudioService(IAudioBackend& backend, const IAudioSettingsProvider& settingsProvider);
    ~AudioService() override;

    void Play(domain::SoundCue cue) override;
    void StartLoop(domain::SoundCue cue) override;
    void StopLoop() override;
    void SetBackground(domain::AudioBackground background) override;
    void StopAll() override;
    void ShutdownImmediately() override;

private:
    void PreloadCommonSounds();

    IAudioBackend& backend_;
    const IAudioSettingsProvider& settingsProvider_;
    std::atomic_bool shuttingDown_ = false;
};
}
