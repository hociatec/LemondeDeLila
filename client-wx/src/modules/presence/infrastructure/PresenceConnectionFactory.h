#pragma once

#include <string>

#include "shared/network/websocket/IWebSocketClient.h"

namespace lila::shared::network::http { class WsTicketProvider; }

namespace lila::modules::presence::infrastructure
{
[[nodiscard]] lila::shared::network::websocket::WebSocketHeaders BuildPresenceHeaders(
    lila::shared::network::http::WsTicketProvider& ticketProvider,
    const std::string& bearerToken);

[[nodiscard]] const std::string& TavernContextPayload();
}
