#pragma once

#include <string>
#include <string_view>

#include "shared/config/domain/AppConfig.h"
#include "shared/network/application/http/IWsTicketProvider.h"
#include "shared/network/application/websocket/IWebSocketClient.h"
#include "shared/network/domain/WebSocketConstants.h"

namespace lila::shared::network::websocket
{
inline WebSocketHeaders BuildAuthenticatedHeaders(
    const lila::shared::network::http::IWsTicketProvider& ticketProvider,
    std::string_view ticketScope,
    const std::string& bearerToken)
{
    using namespace lila::shared::network::ws;
    return {
        {std::string(ClientProductHeader), std::string(ClientProduct)},
        {std::string(AuthorizationHeader), std::string(AuthorizationScheme) + bearerToken},
        {std::string(WsTicketHeader), ticketProvider.GetTicket(std::string(ticketScope), bearerToken)},
        {std::string(ClientVersionHeader), lila::shared::config::AppConfig::ResolveClientVersion()}};
}
}
