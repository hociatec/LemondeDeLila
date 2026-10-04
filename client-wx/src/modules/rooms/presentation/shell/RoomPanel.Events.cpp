#include "modules/rooms/presentation/shell/RoomPanel.h"

#include <utility>

#include <wx/event.h>
#include <wx/textctrl.h>
#include <wx/toplevel.h>

#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"
#include "modules/rooms/presentation/zone/RoomGameZoneAnchor.h"
#include "modules/rooms/presentation/model/RoomPresentationModel.h"
#include "shared/accessibility/presentation/ActionButton.h"
#include "shared/accessibility/presentation/NavigationController.h"
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
                if (target != nullptr && target != gameZoneAnchor_ &&
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
            const auto ambience = std::exchange(pendingStartAmbience_, std::nullopt);
            if (ambience && *ambience != room_.tableAmbienceSoundId)
            {
                startAfterAmbience_ = true;
                ExecuteCommand({domain::RoomCommand::SetAmbience, false, *ambience});
                return;
            }
            ExecuteCommand({domain::RoomCommand::Start, false, {}});
        });
    gamePlayPanel_->SetStartAmbienceSelectedHandler(
        [this](std::string soundId) { pendingStartAmbience_ = std::move(soundId); });
    gamePlayPanel_->SetStartAmbiencePreviewHandler(
        [this](std::string soundId) { ToggleAmbiencePreview(soundId); });
    gamePlayPanel_->SetStartAmbienceVolumeHandler(
        [this](int delta) { AdjustAmbienceVolume(delta); });
    chatInput_->Bind(wxEVT_TEXT_ENTER, [this](wxCommandEvent&) { SendChat(); });
    lila::shared::accessibility::NavigationController::BindTabNavigation(
        *this,
        [this]()
        {
            // Tab is an explicit focus decision.  Invalidate any delayed
            // gameplay focus requested by a simultaneous realtime refresh so
            // the same list item cannot receive a second focus notification.
            CancelScheduledGameZoneFocus();
            lila::shared::accessibility::NavigationController::Scope scope;
            // Promote the current interactive control (notably a visible
            // hand) into the table's main navigation. The stable zone anchor
            // remains the fallback when the game has nothing to interact with.
            EnsureGameplayNavigationInvariant();
            scope.Add(GameplayNavigationTarget());
            if (chatInput_->IsShown()) scope.Add(chatInput_);
            scope.Add(history_);
            return scope;
        });
    Bind(wxEVT_CHAR_HOOK, [this](wxKeyEvent& event) { HandleShortcut(event); });
}

void RoomPanel::CancelScheduledGameZoneFocus()
{
    ++focusGeneration_;
}

void RoomPanel::ScheduleGameZoneFocus()
{
    // Resolve after native show/layout and focus-restoration events, not while
    // the pawn overlay or the entire room is still being hidden/revealed.
    const auto generation = ++focusGeneration_;
    CallAfter([weakThis = wxWeakRef<RoomPanel>(this), generation]()
    {
        if (!weakThis || generation != weakThis->focusGeneration_ ||
            !weakThis->IsShownOnScreen()) return;
        auto* top = dynamic_cast<wxTopLevelWindow*>(wxGetTopLevelParent(weakThis.get()));
        if (top != nullptr && !top->IsActive()) return;
        auto* focused = wxWindow::FindFocus();
        const bool insideGame = focused == nullptr || focused == weakThis.get() ||
            focused == weakThis->gameZoneAnchor_ ||
            lila::shared::accessibility::NavigationController::IsDescendantOf(
                focused, weakThis->gamePlayPanel_);
        weakThis->EnsureGameplayNavigationInvariant();
        weakThis->Layout();
        // Visibility and focusability can change during Layout; resolve again
        // only after the final geometry has been applied.
        // Keep the stable Room entry visible, but move focus to a newly
        // authorized priority interaction.  Setup choices (such as pawn
        // selection) and prompt fields must not require an extra Space/Enter
        // merely to become discoverable by the screen reader.
        auto* target = weakThis->gamePlayPanel_->RequiredInteractionTarget();
        if (target == nullptr) target = weakThis->GameplayNavigationTarget();
        if (generation != weakThis->focusGeneration_) return;
        if (!insideGame) return; // Never steal focus from chat or history.
        static_cast<void>(lila::shared::accessibility::NavigationController::Focus(
            target));
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
