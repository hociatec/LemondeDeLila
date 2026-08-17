#pragma once

#include <nlohmann/json.hpp>

#include <string>

#include "shared/network/http/WsTicketProvider.h"
#include "shared/network/realtime/RealtimeApiClient.h"
#include "shared/network/websocket/IWebSocketClient.h"

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
        const std::string& bearerToken) const;

private:
    std::string endpoint_;
    std::string clientVersion_;
    websocket::IWebSocketClient& webSocketClient_;
    http::IWsTicketProvider& wsTicketProvider_;
};
}
