#include "modules/admin/presentation/AdminFrame.h"

#include <memory>

#include <wx/timer.h>

#include "modules/audio/application/IAudioService.h"
#include "modules/audio/domain/SoundCatalog.h"

namespace lila::modules::admin::presentation
{
void AdminFrame::PreviewSound(std::string_view soundId)
{
    const auto* sound =
        lila::modules::audio::domain::FindSoundDescriptorByServerId(soundId);
    if (sound == nullptr) return;

    if (!previewTimer_)
    {
        previewTimer_ = std::make_unique<wxTimer>(this);
        Bind(wxEVT_TIMER, [this](wxTimerEvent&)
        {
            audioService_.StopLoop();
        }, previewTimer_->GetId());
    }
    if (previewTimer_->IsRunning())
    {
        previewTimer_->Stop();
        audioService_.StopLoop();
    }

    if (sound->loop)
    {
        audioService_.StartLoop(sound->cue);
        previewTimer_->StartOnce(5000);
    }
    else
    {
        audioService_.Play(sound->cue);
    }
}
}
