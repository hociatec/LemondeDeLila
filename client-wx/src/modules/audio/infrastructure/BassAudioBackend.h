#pragma once

#include <atomic>

#include "modules/audio/application/IAudioBackend.h"
#include "modules/audio/infrastructure/BassSampleCache.h"
#include "modules/audio/infrastructure/BassStreamCache.h"
#include "modules/audio/infrastructure/SoundAssetPath.h"

namespace lila::modules::audio::infrastructure
{
class BassAudioBackend final : public application::IAudioBackend
{
public:
    BassAudioBackend();
    ~BassAudioBackend() override;

    void Preload(domain::SoundCue cue) override;
    void Play(domain::SoundCue cue, float volume) override;
    void Preview(std::optional<domain::SoundCue> cue) override;
    void SetLoop(std::optional<domain::SoundCue> cue, float volume) override;
    void StopAll() override;
    bool PumpDeferredPlayback() override;
    void RefreshAssets() override;
    void FinishPlayback() override;
    void InterruptPlayback() noexcept override;
    void Shutdown() noexcept override;

private:
    [[nodiscard]] bool EnsureInitialized();

    BassSampleCache samples_;
    BassStreamCache streams_;
    SoundAssetPathResolver assetPaths_;
    HSTREAM previewStream_ = 0;
    std::atomic_bool initialized_ = false;
    std::atomic_bool shuttingDown_ = false;
    std::atomic_bool shutdownComplete_ = false;
    bool modulePinned_ = false;
    std::optional<domain::SoundCue> loopCue_;
    float loopVolume_ = 0.0F;
    HCHANNEL clientOpenedChannel_ = 0;
    std::optional<domain::SoundCue> deferredLoopCue_;
    float deferredLoopVolume_ = 0.0F;
    bool refreshPending_ = false;
};
}
