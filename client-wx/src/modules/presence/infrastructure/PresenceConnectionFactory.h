#pragma once

#include <string>

#include "shared/network/application/websocket/IWebSocketClient.h"

namespace lila::shared::network::http { class IWsTicketProvider; }

namespace lila::modules::presence::infrastructure
{
[[nodiscard]] lila::shared::network::websocket::WebSocketHeaders BuildPresenceHeaders(
    lila::shared::network::http::IWsTicketProvider& ticketProvider,
    const std::string& bearerToken);

[[nodiscard]] const std::string& TavernContextPayload();
}
