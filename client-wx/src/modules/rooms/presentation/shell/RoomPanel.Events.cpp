#include "modules/rooms/presentation/shell/RoomPanel.h"

#include <wx/event.h>
#include <wx/textctrl.h>
#include <wx/toplevel.h>

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
    // Modal returns and native focus restoration can still land on the anchor.
    // Forward focus, never activate a cell or require an extra Enter.
    gameZoneAnchor_->Bind(wxEVT_SET_FOCUS, [this](wxFocusEvent& event)
    {
        event.Skip();
        ScheduleGameZoneFocus();
    });
    Bind(wxEVT_SHOW, [this](wxShowEvent& event)
    {
        event.Skip();
        if (event.IsShown()) ScheduleGameZoneFocus();
    });
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
        [this]() { ScheduleGameZoneFocus(); });
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
            // Promote the current interactive control (notably a visible
            // hand) into the table's main navigation. The stable zone anchor
            // remains the fallback when the game has nothing to interact with.
            auto* gameTarget = gamePlayPanel_->RequiredInteractionTarget();
            scope.Add(gameTarget != nullptr
                ? gameTarget
                : static_cast<wxWindow*>(gameZoneAnchor_));
            if (chatInput_->IsShown()) scope.Add(chatInput_);
            scope.Add(history_);
            return scope;
        });
    Bind(wxEVT_CHAR_HOOK, [this](wxKeyEvent& event) { HandleShortcut(event); });
}

void RoomPanel::ScheduleGameZoneFocus()
{
    // Resolve after native show/layout and focus-restoration events, not while
    // the pawn overlay or the entire room is still being hidden/revealed.
    CallAfter([weakThis = wxWeakRef<RoomPanel>(this)]()
    {
        if (!weakThis || !weakThis->IsShownOnScreen()) return;
        auto* top = dynamic_cast<wxTopLevelWindow*>(wxGetTopLevelParent(weakThis.get()));
        if (top != nullptr && !top->IsActive()) return;
        auto* focused = wxWindow::FindFocus();
        const bool insideGame = focused == nullptr || focused == weakThis.get() ||
            focused == weakThis->gameZoneAnchor_ ||
            lila::shared::accessibility::NavigationController::IsDescendantOf(
                focused, weakThis->gamePlayPanel_);
        auto* target = weakThis->gamePlayPanel_->RequiredInteractionTarget();
        if (target != nullptr && !target->IsShownOnScreen()) target = nullptr;
        // Only one game-zone entry: either the interaction or its fallback.
        weakThis->gameZoneAnchor_->Show(target == nullptr);
        weakThis->Layout();
        if (!insideGame) return; // Never steal focus from chat or history.
        static_cast<void>(lila::shared::accessibility::NavigationController::Focus(
            target != nullptr ? target : static_cast<wxWindow*>(weakThis->gameZoneAnchor_)));
    });
}

void RoomPanel::SendChat()
{
    const auto message = chatInput_->GetValue().Trim(true).Trim(false);
    if (message.empty()) return;
    chatInput_->Clear();
    ExecuteCommand({domain::RoomCommand::SendChat, false, lila::shared::text::ToUtf8(message)});
}
}
