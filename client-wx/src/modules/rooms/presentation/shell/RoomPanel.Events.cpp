#include "modules/rooms/presentation/shell/RoomPanel.h"

#include <wx/event.h>
#include <wx/textctrl.h>

#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"
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
            if (gamePlayPanel_->IsOpen())
            {
                auto* target = gamePlayPanel_->PreferredNavigationTarget();
                if (target != nullptr &&
                    lila::shared::accessibility::NavigationController::Focus(target))
                    return;
                if (gamePlayPanel_->HandleZoneActivation()) return;
            }
            const auto actions = RoomPresentationModel::BuildItems(room_);
            if (!actions.empty()) HandleAction(actions.front().id);
        });
    gameZoneAnchor_->SetKeyHandler(
        [this](wxKeyEvent& event)
        {
            if (gamePlayPanel_->HandleKey(event)) return true;
            return TryHandleShortcut(event);
        });
    gamePlayPanel_->SetZoneFocusRequestedHandler(
        [this]()
        {
            auto* focused = wxWindow::FindFocus();
            const bool focusInsideGame = focused == nullptr || focused == gameZoneAnchor_ ||
                lila::shared::accessibility::NavigationController::IsDescendantOf(
                    focused, gamePlayPanel_);
            if (!focusInsideGame) return;
            auto* target = gamePlayPanel_->PreferredNavigationTarget();
            static_cast<void>(
                lila::shared::accessibility::NavigationController::Focus(
                    target != nullptr ? target : static_cast<wxWindow*>(gameZoneAnchor_)));
        });
    gamePlayPanel_->SetHistoryMessageHandler(
        [this](const wxString& message, bool allowRepeat)
        {
            AppendRoomAnnouncement(message, allowRepeat);
        });
    gamePlayPanel_->SetTableShortcutHandler(
        [this](wxKeyEvent& event)
        {
            return TryHandleShortcut(event);
        });
    gamePlayPanel_->SetRoomStartRequestedHandler(
        [this]()
        {
            ExecuteCommand({domain::RoomCommand::Start, false, {}});
        });
    chatInput_->Bind(wxEVT_TEXT_ENTER, [this](wxCommandEvent&) { SendChat(); });
    lila::shared::accessibility::NavigationController::BindTabNavigation(
        *this,
        [this]()
        {
            lila::shared::accessibility::NavigationController::Scope scope;
            auto* gameTarget = gamePlayPanel_->PreferredNavigationTarget();
            scope.Add(gameTarget != nullptr
                ? gameTarget
                : static_cast<wxWindow*>(gameZoneAnchor_));
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
