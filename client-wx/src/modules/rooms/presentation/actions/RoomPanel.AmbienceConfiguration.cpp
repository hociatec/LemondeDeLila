#include "modules/rooms/presentation/shell/RoomPanel.h"

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
                wxSingleChoiceDialog dialog(weakThis, L"Choisissez une ambiance. Espace : lire ou mettre en pause l’aperçu.", L"Ambiance de table", labels);
                dialog.SetSelection(selected); bool previewing = false;
                const auto preview = [&]()
                {
                    const int choice = dialog.GetSelection();
                    if (choice <= 0 || static_cast<std::size_t>(choice) > result->size()) { weakThis->audioService_.Preview(std::nullopt); previewing = false; return; }
                    const auto* sound = lila::modules::audio::domain::FindSoundDescriptorByServerId((*result)[static_cast<std::size_t>(choice - 1)].soundId);
                    if (sound != nullptr) { weakThis->audioService_.Preview(sound->cue); previewing = true; }
                };
                const auto key = [&](wxKeyEvent& event)
                {
                    if (event.GetKeyCode() != WXK_SPACE && event.GetKeyCode() != WXK_NUMPAD_SPACE) { event.Skip(); return; }
                    if (previewing) weakThis->audioService_.TogglePreviewPause(); else preview();
                };
                const auto bind = [&](auto&& self, wxWindow& window) -> void { window.Bind(wxEVT_KEY_DOWN, key); for (auto* child : window.GetChildren()) self(self, *child); };
                dialog.Bind(wxEVT_CHAR_HOOK, key); bind(bind, dialog);
                const int accepted = dialog.ShowModal(); weakThis->audioService_.Preview(std::nullopt);
                if (accepted != wxID_OK) return;
                const int choice = dialog.GetSelection();
                weakThis->ExecuteCommand({domain::RoomCommand::SetAmbience, false, choice <= 0 ? std::string{} : (*result)[static_cast<std::size_t>(choice - 1)].soundId});
            });
        }));
}
}
