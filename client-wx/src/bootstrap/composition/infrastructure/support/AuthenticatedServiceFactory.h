#pragma once

#include <memory>

#include "modules/session/application/SessionStore.h"
#include "shared/config/domain/AppConfig.h"
#include "shared/network/application/http/IWsTicketProvider.h"
#include "shared/network/application/realtime/AuthenticatedRealtimeApiClient.h"
#include "shared/network/application/websocket/IWebSocketClient.h"

namespace lila::bootstrap::detail
{
[[nodiscard]] std::unique_ptr<shared::network::websocket::IWebSocketClient> CreateWebSocketClient();

template <typename Api, typename Service>
void CreateAuthenticatedServiceStack(
    std::unique_ptr<shared::network::websocket::IWebSocketClient>& webSocketClient,
    std::unique_ptr<shared::network::realtime::AuthenticatedRealtimeApiClient>& realtimeApiClient,
    std::unique_ptr<Api>& api,
    std::unique_ptr<Service>& service,
    shared::network::http::IWsTicketProvider& wsTicketProvider,
    modules::session::application::SessionStore& sessionStore)
{
    webSocketClient = CreateWebSocketClient();
    realtimeApiClient = std::make_unique<shared::network::realtime::AuthenticatedRealtimeApiClient>(
        shared::config::AppConfig::ResolveBackendApiWs(),
        shared::config::AppConfig::ResolveClientVersion(),
        *webSocketClient,
        wsTicketProvider);
    api = std::make_unique<Api>(*realtimeApiClient, sessionStore);
    service = std::make_unique<Service>(*api);
}
}
