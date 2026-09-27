#include "modules/rooms/presentation/shell/RoomPanel.h"

#include <algorithm>
#include <memory>
#include <utility>
#include <wx/choicdlg.h>
#include <wx/event.h>
#include <wx/weakref.h>

#include "modules/audio/application/IAudioService.h"
#include "modules/audio/domain/SoundCatalog.h"
#include "modules/rooms/application/RoomLobbyService.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::rooms::presentation
{
void RoomPanel::ToggleAmbiencePreview(const std::string& soundId)
{
    if (soundId.empty())
    {
        audioService_.Preview(std::nullopt);
        previewedAmbienceSoundId_.clear();
        ambiencePreviewPlaying_ = false;
        return;
    }
    if (previewedAmbienceSoundId_ == soundId)
    {
        audioService_.TogglePreviewPause();
        ambiencePreviewPlaying_ = !ambiencePreviewPlaying_;
        return;
    }
    const auto* sound = lila::modules::audio::domain::FindSoundDescriptorByServerId(soundId);
    if (sound == nullptr) return;
    audioService_.Preview(sound->cue);
    previewedAmbienceSoundId_ = soundId;
    ambiencePreviewPlaying_ = true;
}

void RoomPanel::AdjustAmbienceVolume(int delta)
{
    ambienceVolume_ = std::clamp(ambienceVolume_ + delta, 0, 100);
    audioService_.SetTableAmbienceVolume(ambienceVolume_);
    UpdateStatus(wxString::Format(L"Volume de l’ambiance : %d %%.", ambienceVolume_), false, true);
}

void RoomPanel::ConfigureAmbience()
{
    CancelRequest(); state_ = State::Busy;
    auto result = std::make_shared<std::vector<domain::TableAmbience>>();
    auto* service = &roomLobbyService_; const auto generation = requestSlot_.CurrentToken();
    wxWeakRef<RoomPanel> weakThis(this);
    requestSlot_.Track(lila::shared::concurrency::RunAsync(
        [service, result](std::stop_token token) { *result = service->ListTableAmbiences(token); },
        [weakThis, generation, result](std::optional<lila::shared::errors::AppError> error)
        {
            if (!weakThis) return;
            weakThis->CallAfter([weakThis, generation, result, error = std::move(error)]() mutable
            {
                if (!weakThis || !weakThis->requestSlot_.Complete(generation)) return;
                weakThis->state_ = State::Ready;
                if (error) { weakThis->UpdateStatus(lila::shared::text::FromUtf8(error->UserMessage()), true, true); return; }
                wxArrayString labels{L"Silence (aucune ambiance)"}; int selected = 0;
                for (std::size_t i = 0; i < result->size(); ++i)
                {
                    labels.Add(lila::shared::text::FromUtf8((*result)[i].name));
                    if ((*result)[i].soundId == weakThis->room_.tableAmbienceSoundId) selected = static_cast<int>(i + 1);
                }
                wxSingleChoiceDialog dialog(weakThis,
                    L"Flèche gauche/droite : volume. Espace : lire ou mettre en pause l’aperçu.",
                    L"Ambiance de table", labels);
                dialog.SetSelection(selected);
                const auto key = [&](wxKeyEvent& event)
                {
                    const int keyCode = event.GetKeyCode();
                    if (keyCode == WXK_LEFT || keyCode == WXK_NUMPAD_LEFT)
                    {
                        weakThis->AdjustAmbienceVolume(-5);
                        return;
                    }
                    if (keyCode == WXK_RIGHT || keyCode == WXK_NUMPAD_RIGHT)
                    {
                        weakThis->AdjustAmbienceVolume(5);
                        return;
                    }
                    if (keyCode != WXK_SPACE && keyCode != WXK_NUMPAD_SPACE) { event.Skip(); return; }
                    const int choice = dialog.GetSelection();
                    weakThis->ToggleAmbiencePreview(choice <= 0 ? std::string{}
                        : (*result)[static_cast<std::size_t>(choice - 1)].soundId);
                };
                // CHAR_HOOK is delivered before the dialog's default button.
                // Binding both CHAR_HOOK and KEY_DOWN toggled twice per Space,
                // which made the preview appear not to react.
                dialog.Bind(wxEVT_CHAR_HOOK, key);
                const int accepted = dialog.ShowModal(); weakThis->ToggleAmbiencePreview({});
                if (accepted != wxID_OK) return;
                const int choice = dialog.GetSelection();
                weakThis->ExecuteCommand({domain::RoomCommand::SetAmbience, false, choice <= 0 ? std::string{} : (*result)[static_cast<std::size_t>(choice - 1)].soundId});
            });
        }));
}
}
