#include "shared/network/infrastructure/websocket/WinHttpWebSocketClient.h"

#include <stdexcept>

namespace lila::shared::network::websocket
{
std::string WinHttpWebSocketClient::SendAndReceive(
    const std::string& endpoint,
    const std::string& payload,
    const WebSocketHeaders& headers,
    std::stop_token stopToken)
{
    std::stop_callback cancelOperation(
        stopToken,
        [this]() { CancelPendingOperation(); });
    Connect(endpoint, headers, stopToken);
    ThrowIfCancelled(stopToken);
    Send(payload);
    ThrowIfCancelled(stopToken);
    auto response = Receive();
    ThrowIfCancelled(stopToken);
    return response;
}
}
