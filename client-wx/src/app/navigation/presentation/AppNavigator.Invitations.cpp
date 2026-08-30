#include "app/navigation/presentation/AppNavigator.h"

#include <optional>
#include <utility>

#include <wx/msgdlg.h>
#include <wx/weakref.h>
#include <wx/window.h>

#include "app/navigation/presentation/HostFrame.h"
#include "modules/audio/application/IAudioService.h"
#include "modules/rooms/application/RoomLobbyService.h"
#include "modules/rooms/domain/Room.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::app::navigation
{
namespace
{
void RestoreInvitationFocus(const wxWeakRef<wxWindow>& target)
{
    if (target && target->IsShownOnScreen() && target->IsEnabled() && target->AcceptsFocus())
        target->SetFocus();
}
}

void AppNavigator::HandleRoomInvitation(modules::rooms::domain::RoomInvitation invitation)
{
    if (invitationResponseTask_ || invitationDialogOpen_)
    {
        pendingInvitations_.push_back(std::move(invitation));
        return;
    }
    audioService_.Play(modules::audio::domain::SoundCue::InvitationReceived);
    const auto sender = invitation.fromUsername.empty()
        ? wxString(L"Un utilisateur")
        : lila::shared::text::FromUtf8(invitation.fromUsername);
    const auto room = invitation.roomName.empty()
        ? wxString::Format(L"table %d", invitation.roomId)
        : lila::shared::text::FromUtf8(invitation.roomName);
    const wxWeakRef<wxWindow> focusedBefore(wxWindow::FindFocus());
    invitationDialogOpen_ = true;
    const bool accept = wxMessageBox(
        sender + wxString(L" vous invite à rejoindre ") + room + wxString(L". Accepter ?"),
        wxString(L"Invitation à une table"),
        wxYES_NO | wxNO_DEFAULT | wxICON_QUESTION,
        hostFrame_) == wxYES;
    invitationDialogOpen_ = false;
    RestoreInvitationFocus(focusedBefore);

    auto* service = &roomLobbyService_;
    const wxWeakRef<HostFrame> weakFrame(hostFrame_);
    invitationResponseTask_ = lila::shared::concurrency::RunAsync(
        [service, id = invitation.invitationId, accept](std::stop_token stopToken)
        {
            service->RespondInvite(id, accept, stopToken);
        },
        [this, weakFrame, accept, roomId = invitation.roomId](
            std::optional<lila::shared::errors::AppError> error)
        {
            if (!weakFrame) return;
            weakFrame->CallAfter([this, weakFrame, accept, roomId, error = std::move(error)]() mutable
            {
                invitationResponseTask_.reset();
                if (!weakFrame) return;
                if (error)
                {
                    const wxWeakRef<wxWindow> focusedBeforeError(wxWindow::FindFocus());
                    wxMessageBox(lila::shared::text::FromUtf8(error->UserMessage()),
                        wxString(L"Invitation"), wxOK | wxICON_ERROR, weakFrame);
                    RestoreInvitationFocus(focusedBeforeError);
                }
                else if (accept) JoinRoom(roomId, false);
                if (!pendingInvitations_.empty())
                {
                    auto next = std::move(pendingInvitations_.front());
                    pendingInvitations_.pop_front();
                    HandleRoomInvitation(std::move(next));
                }
            });
        });
}
}
