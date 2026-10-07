#include "modules/audio/infrastructure/BassAudioBackend.h"

namespace lila::modules::audio::infrastructure
{
bool BassAudioBackend::PumpDeferredPlayback()
{
    if (refreshPending_ && !samples_.IsPlaying())
    {
        refreshPending_ = false;
        samples_.Clear();
        streams_.ClearInactive();
        if (loopCue_) SetLoop(loopCue_, loopVolume_);
        assetPaths_.CleanupObsoleteAssets();
    }
    return refreshPending_;
}

void BassAudioBackend::RefreshAssets()
{
    assetPaths_.Invalidate();
    if (samples_.IsPlaying())
    {
        // notify.connected can arrive while ClientOpened is still playing.
        refreshPending_ = true;
        return;
    }
    samples_.Clear();
    // StartOrUpdate preserves the active handle when its path is unchanged.
    streams_.ClearInactive();
    if (loopCue_) SetLoop(loopCue_, loopVolume_);
    assetPaths_.CleanupObsoleteAssets();
}
}
