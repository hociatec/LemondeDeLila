#pragma once

#include <functional>
#include <mutex>
#include <memory>
#include <stop_token>
#include <string>
#include <vector>

#include "modules/presence/domain/PresencePlayer.h"

namespace lila::modules::session::application { class SessionStore; }
namespace lila::modules::audio::application { class IAudioService; }
namespace lila::shared::concurrency { class BackgroundTaskHandle; }
namespace lila::shared::network::http { class IWsTicketProvider; }
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
        lila::shared::network::http::IWsTicketProvider& ticketProvider,
        lila::modules::session::application::SessionStore& sessionStore,
        lila::modules::audio::application::IAudioService& audioService,
        std::function<bool(int)> isFriend);
    ~PresenceMonitor();

    void Start();
    void Stop();
    void SetPlayersChangedHandler(PlayersChangedHandler handler);
    [[nodiscard]] std::vector<domain::PresencePlayer> Players() const;
    [[nodiscard]] std::string Status() const;
    [[nodiscard]] bool HasSnapshot() const;

private:
    void ReceiveLoop(std::stop_token stopToken);
    void Connect(std::stop_token stopToken);
    void ApplyUpdate(const std::string& rawJson);
    void SetStatus(std::string status);
    void NotifyChanged(const PlayersChangedHandler& handler) const;

    std::string endpoint_;
    lila::shared::network::websocket::IWebSocketClient& webSocketClient_;
    lila::shared::network::http::IWsTicketProvider& ticketProvider_;
    lila::modules::session::application::SessionStore& sessionStore_;
    lila::modules::audio::application::IAudioService& audioService_;
    std::function<bool(int)> isFriend_;
    mutable std::mutex mutex_;
    std::vector<domain::PresencePlayer> players_;
    std::string status_ = "Présence déconnectée.";
    bool hasSnapshot_ = false;
    PlayersChangedHandler onPlayersChanged_;
    std::shared_ptr<lila::shared::concurrency::BackgroundTaskHandle> receiveTask_;
};
}
