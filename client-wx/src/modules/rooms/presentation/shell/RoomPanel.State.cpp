#include "modules/rooms/presentation/shell/RoomPanel.h"

#include <wx/stattext.h>
#include <wx/textctrl.h>
#include <wx/window.h>

#include <unordered_set>

#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"
#include "modules/rooms/application/RoomStateUpdatePolicy.h"
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
namespace
{
std::unordered_set<int> HumanMemberIds(const domain::RoomState& room)
{
    std::unordered_set<int> result;
    for (const auto& member : room.players) result.insert(member.id);
    for (const auto& member : room.spectators) result.insert(member.id);
    return result;
}
}

void RoomPanel::ApplyRoom(domain::RoomState room)
{
    if (!application::RoomStateUpdatePolicy::ShouldApply(room_, room)) return;
    const bool isRealtimeUpdate = room_.id != 0 && room_.id == room.id;
    const bool wasStarted = room_.started || room_.status == "started";
    const bool willBeStarted = room.started || room.status == "started";
    const auto previousMembers = isRealtimeUpdate
        ? HumanMemberIds(room_)
        : std::unordered_set<int>{};
    const auto nextMembers = isRealtimeUpdate
        ? HumanMemberIds(room)
        : std::unordered_set<int>{};
    const bool resetCompleted =
        pendingRealtimeCommand_ == domain::RoomCommand::Reset;
    room_ = std::move(room);
    pendingRealtimeCommand_.reset();
    if (resetCompleted) gamePlayPanel_->ResetRoomSetup();
    audioService_.StartTableAmbience(room_.tableAmbienceSoundId);
    if (isRealtimeUpdate && !wasStarted && willBeStarted)
        audioService_.Play(lila::modules::audio::domain::SoundCue::TableStarted);
    if (isRealtimeUpdate && nextMembers.size() > previousMembers.size())
        audioService_.Play(lila::modules::audio::domain::SoundCue::RoomMemberJoined);
    else if (isRealtimeUpdate && nextMembers.size() < previousMembers.size())
        audioService_.Play(lila::modules::audio::domain::SoundCue::RoomMemberLeft);
    state_ = State::Ready;
    ShowRoom();
    if (resetCompleted)
    {
        AppendRoomAnnouncement(wxString(L"Table réinitialisée. Vous pouvez de nouveau "
                                        L"ajouter ou retirer des bots puis configurer la partie."));
        static_cast<void>(
            lila::shared::accessibility::NavigationController::Focus(gameZoneAnchor_));
    }
}

void RoomPanel::SyncGamePlayPanel()
{
    const bool isStarted = room_.started || room_.status == "started";
    gameZoneAnchor_->Show(true);
    if (!gamePlayPanel_->IsOpenFor(room_.id, room_.gameType))
    {
        gamePlayPanel_->Open(room_.id, room_.gameType, room_.gameName, isStarted);
    }
    gamePlayPanel_->SetRoomStarted(isStarted);
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
    detailsLabel_->SetLabel(RoomPresentationModel::BuildDetails(
        room_, request_.gameSummary, request_.gameEngine));
    detailsLabel_->Wrap(640);
    detailsLabel_->Show(!isStarted);
    chatTitle_->Show(room_.chatEnabled);
    chatInput_->Show(room_.chatEnabled);
    chatInput_->Enable(room_.chatEnabled && state_ == State::Ready);
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
    const bool hasUsableFocusInsideRoom = focused != nullptr &&
        lila::shared::accessibility::NavigationController::IsDescendantOf(focused, this) &&
        focused->IsShownOnScreen() && focused->IsEnabled() && focused->AcceptsFocus();
    if (IsShownOnScreen() &&
        !hasUsableFocusInsideRoom)
        static_cast<void>(lila::shared::accessibility::FocusCoordinator::Apply(BuildFocusPlan()));
}

void RoomPanel::AppendHistory(const wxString& message)
{
    if (message.empty()) return;
    if (!history_->IsEmpty()) history_->AppendText(wxString(L"\n"));
    history_->AppendText(message);
}

void RoomPanel::AppendRoomAnnouncement(const wxString& message, bool allowRepeat)
{
    if (message.empty()) return;
    const auto history = history_->GetValue();
    if (!allowRepeat &&
        (history == message || history.EndsWith(wxString(L"\n") + message))) return;
    if (!chatHistoryReceived_) pendingRoomAnnouncements_.push_back(message);
    AppendHistory(message);
    historyAnnouncements_->Enqueue(message, allowRepeat);
}

void RoomPanel::ResetHistoryAnnouncements()
{
    if (historyAnnouncements_) historyAnnouncements_->Reset();
}
}
