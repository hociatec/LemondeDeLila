#pragma once

#include <nlohmann/json.hpp>
#include <mutex>
#include <string>

#include "shared/network/websocket/IWebSocketClient.h"

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

    [[nodiscard]] bool IsType(const std::string& expectedType) const;
};

class RealtimeApiClient final
{
public:
    RealtimeApiClient(
        std::string endpoint,
        websocket::WebSocketHeaders headers,
        websocket::IWebSocketClient& webSocketClient);

    void WarmUp();
    [[nodiscard]] RealtimeApiResponse Send(const RealtimeApiRequest& request);

private:
    std::string endpoint_;
    websocket::WebSocketHeaders headers_;
    websocket::IWebSocketClient& webSocketClient_;
    std::mutex requestMutex_;
};
}
