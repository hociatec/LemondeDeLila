#include "modules/rooms/application/RoomInvitationMonitor.h"

#include <utility>
#include <condition_variable>
#include <chrono>

#include "modules/rooms/infrastructure/RoomInvitationPayloadCodec.h"
#include "modules/session/application/SessionConnectionRetry.h"
#include "modules/session/application/SessionStore.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/network/application/http/IWsTicketProvider.h"
#include "shared/network/application/websocket/AuthenticatedWebSocketHeaders.h"
#include "shared/network/application/websocket/IWebSocketClient.h"
#include "shared/network/domain/WebSocketConstants.h"

namespace lila::modules::rooms::application
{
RoomInvitationMonitor::RoomInvitationMonitor(
    std::string endpoint,
    lila::shared::network::websocket::IWebSocketClient& webSocketClient,
    lila::shared::network::http::IWsTicketProvider& ticketProvider,
    lila::modules::session::application::SessionStore& sessionStore)
    : endpoint_(std::move(endpoint)), webSocketClient_(webSocketClient),
      ticketProvider_(ticketProvider), sessionStore_(sessionStore)
{
}

RoomInvitationMonitor::~RoomInvitationMonitor()
{
    Stop();
}

void RoomInvitationMonitor::Start()
{
    if (receiveThread_.joinable() || !sessionStore_.HasActiveSession()) return;
    receiveThread_ = std::jthread([this](std::stop_token token) { ReceiveLoop(token); });
}

void RoomInvitationMonitor::Stop()
{
    receiveThread_.request_stop();
    try { webSocketClient_.Close(); } catch (...) {}
    if (receiveThread_.joinable()) receiveThread_.join();
}

void RoomInvitationMonitor::SetMessageHandler(std::function<void(const std::string&)> handler)
{
    std::scoped_lock lock(mutex_);
    onMessage_ = std::move(handler);
}

void RoomInvitationMonitor::SetInvitationHandler(InvitationHandler handler)
{
    std::scoped_lock lock(mutex_);
    onInvitation_ = std::move(handler);
}

void RoomInvitationMonitor::ReceiveLoop(std::stop_token stopToken)
{
    while (!stopToken.stop_requested())
    {
        try
        {
            Connect(stopToken);
            while (!stopToken.stop_requested()) ApplyMessage(webSocketClient_.Receive());
        }
        catch (...)
        {
            if (stopToken.stop_requested()) break;
            try { webSocketClient_.Close(); } catch (...) {}
            std::mutex waitMutex;
            std::condition_variable_any wake;
            std::unique_lock lock(waitMutex);
            wake.wait_for(lock, stopToken, std::chrono::seconds(1), [] { return false; });
        }
    }
}

void RoomInvitationMonitor::Connect(std::stop_token stopToken)
{
    const auto connect = [this, stopToken](const std::string& token)
    {
        webSocketClient_.Connect(endpoint_,
            lila::shared::network::websocket::BuildAuthenticatedHeaders(
                ticketProvider_, lila::shared::network::ws::WsTicketScopeNotify, token),
            stopToken);
    };
    lila::modules::session::application::ConnectWithSessionRefresh(
        sessionStore_, stopToken, [this] { webSocketClient_.Close(); }, connect);
}

void RoomInvitationMonitor::ApplyMessage(const std::string& rawJson)
{
    std::function<void(const std::string&)> messageHandler;
    { std::scoped_lock lock(mutex_); messageHandler = onMessage_; }
    if (messageHandler) messageHandler(rawJson);
    auto invitation = lila::modules::rooms::infrastructure::ReadRoomInvitationMessage(rawJson);
    if (!invitation) return;
    InvitationHandler handler;
    {
        std::scoped_lock lock(mutex_);
        handler = onInvitation_;
    }
    if (handler) handler(std::move(*invitation));
}
}
