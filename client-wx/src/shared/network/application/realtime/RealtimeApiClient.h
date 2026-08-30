#pragma once

#include <nlohmann/json.hpp>
#include <chrono>
#include <mutex>
#include <stop_token>
#include <string>

#include "shared/network/application/websocket/IWebSocketClient.h"
#include "shared/network/domain/NetworkPolicy.h"

namespace lila::shared::network::websocket
{
}

namespace lila::shared::network::realtime
{
struct RealtimeApiRequest
{
    std::string type;
    nlohmann::json payload;
};

enum class RealtimeErrorKind
{
    None,
    Transport,
    Authentication,
    Protocol,
    Server,
    Cancelled,
};

struct RealtimeApiResponse
{
    bool success = false;
    std::string type;
    std::string requestId;
    nlohmann::json payload;
    unsigned long statusCode = 0;
    std::string errorMessage;
    RealtimeErrorKind errorKind = RealtimeErrorKind::None;
};

class RealtimeApiClient final
{
public:
    RealtimeApiClient(
        std::string endpoint,
        websocket::WebSocketHeaders headers,
        websocket::IWebSocketClient& webSocketClient,
        std::chrono::milliseconds requestTimeout =
            std::chrono::milliseconds{NetworkTimeouts::ReceiveMs});

    void WarmUp();
    [[nodiscard]] RealtimeApiResponse Send(
        const RealtimeApiRequest& request,
        std::stop_token stopToken = {});

private:
    std::string endpoint_;
    websocket::WebSocketHeaders headers_;
    websocket::IWebSocketClient& webSocketClient_;
    std::chrono::milliseconds requestTimeout_;
    std::timed_mutex requestMutex_;
};
}
