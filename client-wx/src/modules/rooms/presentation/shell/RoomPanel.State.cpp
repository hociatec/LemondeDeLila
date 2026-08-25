#include "modules/rooms/presentation/shell/RoomPanel.h"

#include <wx/stattext.h>
#include <wx/textctrl.h>
#include <wx/window.h>

#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"
#include "modules/rooms/presentation/model/RoomPresentationModel.h"
#include "modules/rooms/presentation/history/HistoryAnnouncementQueue.h"
#include "modules/audio/application/IAudioService.h"
#include "modules/rooms/presentation/zone/RoomGameZoneAnchor.h"
#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/accessibility/application/FocusCoordinator.h"
#include "shared/accessibility/application/NavigationController.h"
#include "shared/text/presentation/encoding/Encoding.h"
#include "shared/ui/presentation/theme/Theme.h"

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

void RoomPanel::SyncGamePlayPanel()
{
    const bool isStarted = room_.started || room_.status == "started";
    gameZoneAnchor_->Show(true);
    gamePlayPanel_->Show(isStarted && !gamePlayPanel_->IsFinished());
    if (!isStarted)
    {
        gamePlayPanel_->CloseSession();
        return;
    }
    if (!gamePlayPanel_->IsOpenFor(room_.id, room_.gameType))
    {
        gamePlayPanel_->Open(room_.id, room_.gameType, room_.gameName);
    }
}

void RoomPanel::ShowConnecting()
{
    state_ = State::Connecting;
    gamePlayPanel_->CloseSession();
    gamePlayPanel_->Hide();
    gameZoneAnchor_->Show(true);
    gameZoneAnchor_->SetTitle(lila::shared::text::FromUtf8(room_.gameName));
    gameNameLabel_->SetLabel(lila::shared::text::FromUtf8(room_.gameName));
    detailsLabel_->Hide();
    chatInput_->Enable(false);
    history_->Clear();
    UpdateStatus(wxString(L"Connexion à la table..."));
}

void RoomPanel::ShowRoom()
{
    const bool isStarted = room_.started || room_.status == "started";
    gameZoneAnchor_->SetTitle(wxString(L"Zone de jeu"));
    SyncGamePlayPanel();
    gameNameLabel_->SetLabel(lila::shared::text::FromUtf8(room_.gameName));
    UpdateStatus(RoomPresentationModel::BuildStatus(room_));
    detailsLabel_->SetLabel(RoomPresentationModel::BuildDetails(room_));
    detailsLabel_->Wrap(640);
    detailsLabel_->Show(!isStarted);
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
    gamePlayPanel_->CloseSession();
    gamePlayPanel_->Hide();
    gameZoneAnchor_->Show(true);
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
    historyAnnouncements_->Enqueue(message);
}

void RoomPanel::ResetHistoryAnnouncements()
{
    if (historyAnnouncements_) historyAnnouncements_->Reset();
}
}
