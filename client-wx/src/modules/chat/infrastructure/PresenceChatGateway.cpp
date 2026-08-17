#include "modules/chat/infrastructure/PresenceChatGateway.h"

#include <utility>

#include "shared/network/http/WsTicketProvider.h"
#include "shared/network/websocket/IWebSocketClient.h"
#include "shared/network/websocket/WinHttpWebSocketClient.h"

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

PresenceChatGateway::PresenceChatGateway(
    std::string endpoint,
    lila::shared::network::websocket::WinHttpWebSocketClient& webSocketClient,
    lila::shared::network::http::WsTicketProvider& ticketProvider)
    : PresenceChatGateway(
          std::move(endpoint),
          static_cast<lila::shared::network::websocket::IWebSocketClient&>(webSocketClient),
          ticketProvider)
{
}

void PresenceChatGateway::Open(const std::string& bearerToken, const std::string& clientVersion)
{
    const std::string ticket = ticketProvider_.GetTicket("presence", bearerToken);
    lila::shared::network::websocket::WebSocketHeaders headers;
    headers.emplace("Authorization", "Bearer " + bearerToken);
    headers.emplace("x-lila-client-version", clientVersion);
    headers.emplace("x-lila-ws-ticket", ticket);
    webSocketClient_.Connect(endpoint_, headers);
}

void PresenceChatGateway::Close()
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
