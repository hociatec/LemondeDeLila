#include "modules/presence/infrastructure/PresenceConnectionFactory.h"

#include "shared/config/domain/AppConfig.h"
#include "shared/network/domain/WebSocketConstants.h"
#include "shared/network/application/http/IWsTicketProvider.h"

namespace lila::modules::presence::infrastructure
{
lila::shared::network::websocket::WebSocketHeaders BuildPresenceHeaders(
    lila::shared::network::http::IWsTicketProvider& ticketProvider,
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
