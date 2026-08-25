#pragma once

#include <cstddef>
#include <functional>
#include <memory>
#include <stop_token>
#include <string>
#include <string_view>
#include <vector>

#include "modules/rooms/domain/Room.h"
#include "modules/rooms/presentation/navigation/RoomOpenRequest.h"
#include "shared/accessibility/application/FocusPlanView.h"
#include "shared/accessibility/presentation/NonFocusablePanel.h"
#include "shared/concurrency/application/AsyncRequestSlot.h"

class wxStaticText;
class wxTextCtrl;
class wxWindow;
class wxKeyEvent;
namespace lila::shared::accessibility { class ActionButton; }
namespace lila::modules::gameplay::application { class GameSessionService; }
namespace lila::modules::gameplay::presentation { class GamePlayPanel; }
namespace lila::modules::rooms::application { class RoomSessionService; }
namespace lila::modules::audio::application { class IAudioService; }

namespace lila::modules::rooms::presentation
{
namespace history { class HistoryAnnouncementQueue; }
class RoomGameZoneAnchor;
class RoomPanel final : public lila::shared::accessibility::NonFocusablePanel,
                        public lila::shared::accessibility::FocusPlanView
{
public:
    using PreparedHandler = std::function<void()>;
    using CloseRequestedHandler = std::function<void()>;
    using CurrentUserIdProvider = std::function<int()>;
    using SaveRequestedHandler = std::function<std::string(int, std::stop_token)>;
    using AbandonRequestedHandler = std::function<void(int, std::stop_token)>;

    RoomPanel(
        wxWindow* parent,
        application::RoomSessionService& roomService,
        lila::modules::gameplay::application::GameSessionService& gameService,
        lila::modules::audio::application::IAudioService& audioService,
        CurrentUserIdProvider currentUserId,
        SaveRequestedHandler onSaveRequested,
        AbandonRequestedHandler onAbandonRequested,
        CloseRequestedHandler onCloseRequested);
    ~RoomPanel() override;

    void PrepareCreate(std::string gameType, PreparedHandler onPrepared);
    void PrepareCreate(
        std::string gameType,
        std::string gameName,
        std::string gameSummary,
        std::string gameEngine,
        int minPlayers,
        int maxPlayers,
        PreparedHandler onPrepared);
    void PrepareJoin(
        int roomId,
        bool spectator,
        PreparedHandler onPrepared);
    void PrepareRestore(int roomId, PreparedHandler onPrepared);
    [[nodiscard]] lila::shared::accessibility::FocusManager::Plan BuildFocusPlan() override;

private:
    enum class State { Connecting, Ready, Busy, Error };

    void BuildLayout();
    void BindEvents();
    void StartRequest();
    void ExecuteCommand(domain::RoomCommandRequest request);
    void HandleAction(std::string_view itemId);
    void HandleShortcut(wxKeyEvent& event);
    [[nodiscard]] bool TryHandleShortcut(wxKeyEvent& event);
    void SendChat();
    void AppendHistory(const wxString& message);
    void AppendRoomAnnouncement(const wxString& message);
    void ResetHistoryAnnouncements();
    void Save();
    void Leave();
    void RequestLeaveConfirmation();
    void RequestResetConfirmation();
    void ApplyRoom(domain::RoomState room);
    void SyncGamePlayPanel();
    void ShowConnecting();
    void ShowRoom();
    void ShowError(const wxString& message, PreparedHandler onPrepared);
    void UpdateStatus(const wxString& message, bool isError = false, bool announce = false);
    void CancelRequest();
    void AttachEventHandler();
    void HandleRoomEvent(domain::RoomEvent event);
    void CloseSession();
    void ApplyInitialFocusIfNeeded();

    application::RoomSessionService& roomService_;
    lila::modules::gameplay::application::GameSessionService& gameService_;
    lila::modules::audio::application::IAudioService& audioService_;
    CurrentUserIdProvider currentUserId_;
    SaveRequestedHandler onSaveRequested_;
    AbandonRequestedHandler onAbandonRequested_;
    CloseRequestedHandler onCloseRequested_;
    RoomGameZoneAnchor* gameZoneAnchor_ = nullptr;
    lila::modules::gameplay::presentation::GamePlayPanel* gamePlayPanel_ = nullptr;
    wxStaticText* statusLabel_ = nullptr;
    wxStaticText* detailsLabel_ = nullptr;
    wxStaticText* gameNameLabel_ = nullptr;
    wxStaticText* chatTitle_ = nullptr;
    wxTextCtrl* chatInput_ = nullptr;
    wxTextCtrl* history_ = nullptr;
    domain::RoomState room_;
    lila::shared::concurrency::AsyncRequestSlot requestSlot_;
    RoomOpenRequest request_;
    State state_ = State::Connecting;
    bool saveInProgress_ = false;
    bool abandonInProgress_ = false;
    bool chatHistoryReceived_ = false;
    std::vector<wxString> pendingRoomAnnouncements_;
    std::unique_ptr<history::HistoryAnnouncementQueue> historyAnnouncements_;
};
}
