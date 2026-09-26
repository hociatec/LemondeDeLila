#include "modules/admin/presentation/AdminFrame.h"

#include <wx/msgdlg.h>

#include "modules/audio/application/IAudioService.h"
#include "modules/audio/domain/SoundCatalog.h"

namespace lila::modules::admin::presentation
{
bool AdminFrame::ConfirmSoundChange(const domain::AdminCommand& command)
{
    return command.id == "sounds.upload" || command.id == "sounds.enable" ||
        command.id == "sounds.clear" || command.id.starts_with("sounds.ambience.");
}

void AdminFrame::PreviewSound(std::string_view soundId)
{
    const auto* sound =
        lila::modules::audio::domain::FindSoundDescriptorByServerId(soundId);
    if (sound == nullptr)
    {
        wxMessageBox(L"Ce son est inconnu du client.", L"Aperçu du son",
            wxOK | wxICON_ERROR, this);
        return;
    }
    audioService_.Preview(sound->cue);
}
}
