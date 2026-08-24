#include "modules/rooms/presentation/RoomPanel.h"

#include <wx/stattext.h>
#include <wx/textctrl.h>
#include <wx/window.h>

#include "modules/rooms/presentation/RoomPresentationModel.h"
#include "modules/rooms/presentation/RoomGameZoneAnchor.h"
#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/accessibility/FocusCoordinator.h"
#include "shared/accessibility/NavigationController.h"
#include "shared/text/Encoding.h"
#include "shared/ui/Theme.h"

namespace lila::modules::rooms::presentation
{
void RoomPanel::ApplyRoom(domain::RoomState room)
{
    room.gameSummary = room_.gameSummary;
    room.gameEngine = room_.gameEngine;
    room_ = std::move(room);
    state_ = State::Ready;
    ShowRoom();
}

void RoomPanel::ShowConnecting()
{
    state_ = State::Connecting;
    gameZoneAnchor_->SetTitle(lila::shared::text::FromUtf8(room_.gameName));
    gameNameLabel_->SetLabel(lila::shared::text::FromUtf8(room_.gameName));
    detailsLabel_->Hide();
    chatInput_->Enable(false);
    history_->Clear();
    UpdateStatus(wxString(L"Connexion à la table..."));
}

void RoomPanel::ShowRoom()
{
    const auto actions = RoomPresentationModel::BuildItems(room_);
    if (!actions.empty()) gameZoneAnchor_->SetTitle(actions.front().label);
    gameNameLabel_->SetLabel(lila::shared::text::FromUtf8(room_.gameName));
    UpdateStatus(RoomPresentationModel::BuildStatus(room_));
    detailsLabel_->SetLabel(RoomPresentationModel::BuildDetails(room_));
    detailsLabel_->Wrap(640);
    detailsLabel_->Show(true);
    chatTitle_->Show(room_.chatEnabled);
    chatInput_->Show(room_.chatEnabled);
    chatInput_->Enable(room_.chatEnabled && state_ == State::Ready);
    if (history_->IsEmpty())
        AppendHistory(wxString(L"Table de ") + lila::shared::text::FromUtf8(room_.gameName) +
            wxString(L" créée. Ajoutez des bots et commencez à jouer."));
    Layout();
    ApplyInitialFocusIfNeeded();
}

void RoomPanel::ShowError(const wxString& message, PreparedHandler onPrepared)
{
    state_ = State::Error;
    gameZoneAnchor_->SetTitle(wxString(L"R\u00E9essayer"));
    UpdateStatus(message, true);
    ApplyInitialFocusIfNeeded();
    if (onPrepared) onPrepared();
}

void RoomPanel::UpdateStatus(const wxString& message, bool isError, bool announce)
{
    statusLabel_->SetLabel(message);
    statusLabel_->SetForegroundColour(
        isError ? lila::shared::ui::Theme::Error() : lila::shared::ui::Theme::Accent());
    statusLabel_->Show(!message.empty());
    if (announce)
        lila::shared::accessibility::AccessibilityUtils::AnnounceStatus(*statusLabel_, message);
    else
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleStatus(*statusLabel_, message);
    Layout();
}

void RoomPanel::ApplyInitialFocusIfNeeded()
{
    auto* focused = wxWindow::FindFocus();
    if (IsShownOnScreen() &&
        (focused == nullptr || !lila::shared::accessibility::NavigationController::IsDescendantOf(focused, this)))
        static_cast<void>(lila::shared::accessibility::FocusCoordinator::Apply(BuildFocusPlan()));
}

void RoomPanel::AppendHistory(const wxString& message)
{
    if (message.empty()) return;
    if (!history_->IsEmpty()) history_->AppendText(wxString(L"\n"));
    history_->AppendText(message);
}

void RoomPanel::AppendRoomAnnouncement(const wxString& message)
{
    if (message.empty()) return;
    if (!chatHistoryReceived_) pendingRoomAnnouncements_.push_back(message);
    AppendHistory(message);
}
}
