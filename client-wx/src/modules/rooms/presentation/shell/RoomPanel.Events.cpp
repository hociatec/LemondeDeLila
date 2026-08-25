#include "modules/rooms/presentation/shell/RoomPanel.h"

#include <wx/event.h>
#include <wx/textctrl.h>

#include "modules/gameplay/presentation/panel/GamePlayPanel.h"
#include "modules/rooms/presentation/zone/RoomGameZoneAnchor.h"
#include "modules/rooms/presentation/model/RoomPresentationModel.h"
#include "shared/accessibility/presentation/ActionButton.h"
#include "shared/accessibility/application/NavigationController.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::rooms::presentation
{
void RoomPanel::BindEvents()
{
    gameZoneAnchor_->SetActivatedHandler(
        [this]()
        {
            if (state_ == State::Connecting || state_ == State::Busy) return;
            if (state_ == State::Error)
            {
                StartRequest();
                return;
            }
            if (gamePlayPanel_->IsOpen() && gamePlayPanel_->ActivateFromZone()) return;
            const auto actions = RoomPresentationModel::BuildItems(room_);
            if (!actions.empty()) HandleAction(actions.front().id);
        });
    gameZoneAnchor_->SetKeyHandler(
        [this](wxKeyEvent& event)
        {
            const int key = event.GetKeyCode();
            const bool tableShortcutHasPriority =
                event.ControlDown() || event.AltDown() || event.MetaDown() ||
                key == 'Q' || key == 'q' || key == 'X' || key == 'x';
            if (tableShortcutHasPriority && TryHandleShortcut(event))
                return true;
            if (gamePlayPanel_->IsOpen() && gamePlayPanel_->HandleZoneKey(event))
                return true;
            if (tableShortcutHasPriority) return false;
            return TryHandleShortcut(event);
        });
    gamePlayPanel_->SetZoneFocusRequestedHandler(
        [this]()
        {
            static_cast<void>(
                lila::shared::accessibility::NavigationController::Focus(gameZoneAnchor_));
        });
    gamePlayPanel_->SetHistoryMessageHandler(
        [this](const wxString& message)
        {
            AppendRoomAnnouncement(message);
        });
    gamePlayPanel_->SetTableShortcutHandler(
        [this](wxKeyEvent& event)
        {
            return TryHandleShortcut(event);
        });
    chatInput_->Bind(wxEVT_TEXT_ENTER, [this](wxCommandEvent&) { SendChat(); });
    lila::shared::accessibility::NavigationController::BindTabNavigation(
        *this,
        [this]()
        {
            lila::shared::accessibility::NavigationController::Scope scope;
            scope.Add(gameZoneAnchor_);
            if (chatInput_->IsShown()) scope.Add(chatInput_);
            scope.Add(history_);
            return scope;
        });
    Bind(wxEVT_CHAR_HOOK, [this](wxKeyEvent& event) { HandleShortcut(event); });
}

void RoomPanel::SendChat()
{
    const auto message = chatInput_->GetValue().Trim(true).Trim(false);
    if (message.empty()) return;
    chatInput_->Clear();
    ExecuteCommand({domain::RoomCommand::SendChat, false, lila::shared::text::ToUtf8(message)});
}
}
