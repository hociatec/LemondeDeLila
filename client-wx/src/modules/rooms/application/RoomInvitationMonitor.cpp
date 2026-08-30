#include "modules/rooms/application/RoomInvitationMonitor.h"

#include <utility>

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
    if (receiveTask_ || !sessionStore_.HasActiveSession()) return;
    receiveTask_ = lila::shared::concurrency::RunAsync(
        [this](std::stop_token stopToken) { ReceiveLoop(stopToken); },
        [this](std::optional<lila::shared::errors::AppError>) { receiveTask_.reset(); });
}

void RoomInvitationMonitor::Stop()
{
    if (receiveTask_)
    {
        receiveTask_->RequestCancel();
        receiveTask_.reset();
    }
    try { webSocketClient_.Close(); } catch (...) {}
}

void RoomInvitationMonitor::SetInvitationHandler(InvitationHandler handler)
{
    std::scoped_lock lock(mutex_);
    onInvitation_ = std::move(handler);
}

void RoomInvitationMonitor::ReceiveLoop(std::stop_token stopToken)
{
    Connect(stopToken);
    while (!stopToken.stop_requested()) ApplyMessage(webSocketClient_.Receive());
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
