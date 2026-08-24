#pragma once

#include <memory>

#include "bootstrap/composition/application/StepLogger.h"

namespace lila::shared::network::http
{
class IWsTicketProvider;
}

namespace lila::shared::network::realtime
{
class AuthenticatedRealtimeApiClient;
class RealtimeApiClient;
}

namespace lila::shared::network::websocket
{
class IWebSocketClient;
}

namespace lila::bootstrap
{
struct NetworkComposition final
{
    NetworkComposition();
    ~NetworkComposition();

    void Assemble(const StepLogger& setStep);

    std::unique_ptr<lila::shared::network::websocket::IWebSocketClient> realtimeWebSocketClient;
    std::unique_ptr<lila::shared::network::websocket::IWebSocketClient> authenticatedRealtimeWebSocketClient;
    std::unique_ptr<lila::shared::network::websocket::IWebSocketClient> presenceChatWebSocketClient;
    std::unique_ptr<lila::shared::network::websocket::IWebSocketClient> presenceWebSocketClient;
    std::unique_ptr<lila::shared::network::http::IWsTicketProvider> wsTicketProvider;
    std::unique_ptr<lila::shared::network::realtime::RealtimeApiClient> realtimeApiClient;
    std::unique_ptr<lila::shared::network::realtime::AuthenticatedRealtimeApiClient>
        authenticatedRealtimeApiClient;
};
}
