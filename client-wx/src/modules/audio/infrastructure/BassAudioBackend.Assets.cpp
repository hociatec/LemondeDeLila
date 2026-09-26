#include "modules/audio/infrastructure/BassAudioBackend.h"

namespace lila::modules::audio::infrastructure
{
bool BassAudioBackend::PumpDeferredPlayback()
{
    if (refreshPending_ && !samples_.IsPlaying())
    {
        refreshPending_ = false;
        samples_.Clear();
        streams_.Clear();
        if (loopCue_) SetLoop(loopCue_, loopVolume_);
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
    streams_.Clear();
    if (loopCue_) SetLoop(loopCue_, loopVolume_);
}
}
