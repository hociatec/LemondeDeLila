#include "bootstrap/composition/infrastructure/network/NetworkComposition.h"

#include <memory>
#include <string>
#include <utility>

#include "bootstrap/composition/infrastructure/support/AuthenticatedServiceFactory.h"
#include "shared/config/domain/AppConfig.h"
#include "shared/network/application/http/IWsTicketProvider.h"
#include "shared/network/application/realtime/AuthenticatedRealtimeApiClient.h"
#include "shared/network/application/realtime/RealtimeApiClient.h"
#include "shared/network/application/websocket/IWebSocketClient.h"
#include "shared/network/domain/WebSocketConstants.h"
#include "shared/network/infrastructure/http/WsTicketProvider.h"

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
        std::string(shared::network::ws::ClientProductHeader),
        std::string(shared::network::ws::ClientProduct));
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
