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
    // Keep the currently audible loop alive.  In particular, notify.connected
    // arrives shortly after startup: recreating this stream made the menu
    // music restart a few seconds after it had already begun.  Inactive
    // streams are still evicted, and the active one is reloaded naturally on
    // the next background change if its remote asset changed.
    streams_.ClearInactive();
}
}
