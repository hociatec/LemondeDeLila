#include "modules/presence/infrastructure/PresenceConnectionFactory.h"

#include "shared/config/AppConfig.h"
#include "shared/network/WebSocketConstants.h"
#include "shared/network/http/WsTicketProvider.h"

namespace lila::modules::presence::infrastructure
{
lila::shared::network::websocket::WebSocketHeaders BuildPresenceHeaders(
    lila::shared::network::http::WsTicketProvider& ticketProvider,
    const std::string& bearerToken)
{
    using namespace lila::shared::network::ws;

    lila::shared::network::websocket::WebSocketHeaders headers;
    headers.emplace(std::string(AuthorizationHeader), std::string(AuthorizationScheme) + bearerToken);
    headers.emplace(std::string(ClientVersionHeader), lila::shared::config::AppConfig::ResolveClientVersion());
    headers.emplace(std::string(WsTicketHeader), ticketProvider.GetTicket(std::string(WsTicketScopePresence), bearerToken));
    return headers;
}

const std::string& TavernContextPayload()
{
    static const std::string payload = R"({"type":"presence-context","context":"tavern"})";
    return payload;
}
}
