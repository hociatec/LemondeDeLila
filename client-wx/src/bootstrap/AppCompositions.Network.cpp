#include "bootstrap/AppCompositions.h"

#include <memory>
#include <string>
#include <utility>

#include "bootstrap/AppCompositionFactories.h"
#include "shared/config/AppConfig.h"
#include "shared/network/WebSocketConstants.h"
#include "shared/network/http/WsTicketProvider.h"
#include "shared/network/realtime/AuthenticatedRealtimeApiClient.h"
#include "shared/network/realtime/RealtimeApiClient.h"
#include "shared/network/websocket/IWebSocketClient.h"

namespace lila::bootstrap
{
NetworkComposition::NetworkComposition() = default;
NetworkComposition::~NetworkComposition() = default;

void NetworkComposition::Assemble(const StepLogger& setStep)
{
    setStep("Creation des transports reseau");
    realtimeWebSocketClient = detail::CreateWebSocketClient();
    authenticatedRealtimeWebSocketClient = detail::CreateWebSocketClient();
    presenceChatWebSocketClient = detail::CreateWebSocketClient();
    presenceWebSocketClient = detail::CreateWebSocketClient();

    setStep("Creation du fournisseur de tickets");
    wsTicketProvider = std::make_unique<shared::network::http::WsTicketProvider>(
        shared::config::AppConfig::ResolveBackendApiWs());

    setStep("Creation du client temps-reel");
    shared::network::websocket::WebSocketHeaders realtimeHeaders;
    realtimeHeaders.emplace(
        std::string(shared::network::ws::ClientVersionHeader),
        shared::config::AppConfig::ResolveClientVersion());
    realtimeApiClient = std::make_unique<shared::network::realtime::RealtimeApiClient>(
        shared::config::AppConfig::ResolveBackendApiWs(),
        std::move(realtimeHeaders),
        *realtimeWebSocketClient);

    setStep("Creation du client temps-reel authentifie");
    authenticatedRealtimeApiClient =
        std::make_unique<shared::network::realtime::AuthenticatedRealtimeApiClient>(
            shared::config::AppConfig::ResolveBackendApiWs(),
            shared::config::AppConfig::ResolveClientVersion(),
            *authenticatedRealtimeWebSocketClient,
            *wsTicketProvider);
}
}
