#pragma once

#include <functional>
#include <memory>
#include <mutex>
#include <stop_token>
#include <string>
#include <thread>

#include "modules/rooms/domain/Room.h"

namespace lila::modules::session::application { class SessionStore; }
namespace lila::shared::concurrency { class BackgroundTaskHandle; }
namespace lila::shared::network::http { class IWsTicketProvider; }
namespace lila::shared::network::websocket { class IWebSocketClient; }

namespace lila::modules::rooms::application
{
class RoomInvitationMonitor final
{
public:
    using InvitationHandler = std::function<void(domain::RoomInvitation)>;

    RoomInvitationMonitor(
        std::string endpoint,
        lila::shared::network::websocket::IWebSocketClient& webSocketClient,
        lila::shared::network::http::IWsTicketProvider& ticketProvider,
        lila::modules::session::application::SessionStore& sessionStore);
    ~RoomInvitationMonitor();

    void Start();
    void Stop();
    void SetInvitationHandler(InvitationHandler handler);
    void SetMessageHandler(std::function<void(const std::string&)> handler);

private:
    void ReceiveLoop(std::stop_token stopToken);
    void Connect(std::stop_token stopToken);
    void ApplyMessage(const std::string& rawJson);

    std::string endpoint_;
    lila::shared::network::websocket::IWebSocketClient& webSocketClient_;
    lila::shared::network::http::IWsTicketProvider& ticketProvider_;
    lila::modules::session::application::SessionStore& sessionStore_;
    std::mutex mutex_;
    InvitationHandler onInvitation_;
    std::function<void(const std::string&)> onMessage_;
    std::jthread receiveThread_;
};
}
