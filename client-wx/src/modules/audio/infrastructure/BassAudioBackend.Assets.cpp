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
    if (!deferredLoopCue_.has_value()) return refreshPending_;
    if (clientOpenedChannel_ != 0 &&
        BASS_ChannelIsActive(clientOpenedChannel_) == BASS_ACTIVE_PLAYING)
    {
        return true;
    }
    clientOpenedChannel_ = 0;
    const auto cue = *deferredLoopCue_;
    const float volume = deferredLoopVolume_;
    deferredLoopCue_.reset();
    streams_.StartOrUpdate(cue, assetPaths_.Resolve(cue), volume, shuttingDown_);
    return false;
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
