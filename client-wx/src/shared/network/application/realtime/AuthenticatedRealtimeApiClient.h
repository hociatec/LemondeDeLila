#pragma once

#include <nlohmann/json.hpp>

#include <mutex>
#include <stop_token>
#include <string>

#include "shared/network/application/http/IWsTicketProvider.h"
#include "shared/network/application/realtime/RealtimeApiClient.h"
#include "shared/network/application/websocket/IWebSocketClient.h"

namespace lila::shared::network::realtime
{
class AuthenticatedRealtimeApiClient final
{
public:
    AuthenticatedRealtimeApiClient(
        std::string endpoint,
        std::string clientVersion,
        websocket::IWebSocketClient& webSocketClient,
        http::IWsTicketProvider& wsTicketProvider);

    [[nodiscard]] RealtimeApiResponse Send(
        const RealtimeApiRequest& request,
        const std::string& bearerToken,
        std::stop_token stopToken = {}) const;

private:
    std::string endpoint_;
    std::string clientVersion_;
    websocket::IWebSocketClient& webSocketClient_;
    http::IWsTicketProvider& wsTicketProvider_;
    mutable std::timed_mutex requestMutex_;
};
}
