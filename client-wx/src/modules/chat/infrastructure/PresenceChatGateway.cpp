#include "modules/chat/infrastructure/PresenceChatGateway.h"

#include <utility>

#include "shared/network/WebSocketConstants.h"
#include "shared/network/http/WsTicketProvider.h"
#include "shared/network/websocket/IWebSocketClient.h"

namespace lila::modules::chat::infrastructure
{
PresenceChatGateway::PresenceChatGateway(
    std::string endpoint,
    lila::shared::network::websocket::IWebSocketClient& webSocketClient,
    lila::shared::network::http::WsTicketProvider& ticketProvider)
    : endpoint_(std::move(endpoint)),
      webSocketClient_(webSocketClient),
      ticketProvider_(ticketProvider)
{
}

void PresenceChatGateway::Open(const std::string& bearerToken, const std::string& clientVersion)
{
    const std::string ticket = ticketProvider_.GetTicket(
        std::string(lila::shared::network::ws::WsTicketScopePresence),
        bearerToken);
    lila::shared::network::websocket::WebSocketHeaders headers;
    headers.emplace(
        std::string(lila::shared::network::ws::AuthorizationHeader),
        std::string(lila::shared::network::ws::AuthorizationScheme) + bearerToken);
    headers.emplace(
        std::string(lila::shared::network::ws::ClientVersionHeader),
        clientVersion);
    headers.emplace(
        std::string(lila::shared::network::ws::WsTicketHeader),
        ticket);
    webSocketClient_.Connect(endpoint_, headers);
}

void PresenceChatGateway::Close()
{
    webSocketClient_.Close();
}

void PresenceChatGateway::Interrupt()
{
    webSocketClient_.Close();
}

void PresenceChatGateway::Send(const std::string& payload)
{
    webSocketClient_.Send(payload);
}

std::string PresenceChatGateway::Receive()
{
    return webSocketClient_.Receive();
}
}
