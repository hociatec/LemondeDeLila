#pragma once

#include <functional>
#include <mutex>
#include <memory>
#include <string>
#include <vector>

#include "modules/presence/domain/PresencePlayer.h"

namespace lila::modules::session::application { class SessionStore; }
namespace lila::shared::concurrency { class BackgroundTaskHandle; }
namespace lila::shared::network::http { class WsTicketProvider; }
namespace lila::shared::network::websocket { class IWebSocketClient; }

namespace lila::modules::presence::application
{
class PresenceMonitor final
{
public:
    using PlayersChangedHandler = std::function<void()>;

    PresenceMonitor(
        std::string endpoint,
        lila::shared::network::websocket::IWebSocketClient& webSocketClient,
        lila::shared::network::http::WsTicketProvider& ticketProvider,
        lila::modules::session::application::SessionStore& sessionStore);
    ~PresenceMonitor();

    void Start();
    void Stop();
    void SetPlayersChangedHandler(PlayersChangedHandler handler);
    [[nodiscard]] std::vector<domain::PresencePlayer> Players() const;
    [[nodiscard]] std::string Status() const;
    [[nodiscard]] bool HasSnapshot() const;
    [[nodiscard]] std::optional<int> CurrentRoomId() const noexcept;

private:
    void ReceiveLoop(std::stop_token stopToken);
    void Connect();
    void ApplyUpdate(const std::string& rawJson);
    void SetStatus(std::string status);
    void NotifyChanged(const PlayersChangedHandler& handler) const;

    std::string endpoint_;
    lila::shared::network::websocket::IWebSocketClient& webSocketClient_;
    lila::shared::network::http::WsTicketProvider& ticketProvider_;
    lila::modules::session::application::SessionStore& sessionStore_;
    mutable std::mutex mutex_;
    std::vector<domain::PresencePlayer> players_;
    std::string status_ = "Presence deconnectee.";
    bool hasSnapshot_ = false;
    std::optional<int> currentRoomId_;
    PlayersChangedHandler onPlayersChanged_;
    std::shared_ptr<lila::shared::concurrency::BackgroundTaskHandle> receiveTask_;
};
}
