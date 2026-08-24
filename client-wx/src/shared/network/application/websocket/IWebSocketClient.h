#pragma once

#include <map>
#include <stop_token>
#include <string>

namespace lila::shared::network::websocket
{
using WebSocketHeaders = std::map<std::string, std::string>;

class IWebSocketClient
{
public:
    virtual ~IWebSocketClient() = default;
    virtual void Connect(
        const std::string& endpoint,
        const WebSocketHeaders& headers = {},
        std::stop_token stopToken = {}) = 0;
    virtual void Close() = 0;
    virtual void CancelPendingOperation() noexcept = 0;
    [[nodiscard]] virtual bool IsConnected() const = 0;
    [[nodiscard]] virtual bool IsConnectedTo(const std::string& endpoint, const WebSocketHeaders& headers = {}) const = 0;
    virtual void Send(const std::string& payload) = 0;
    [[nodiscard]] virtual std::string Receive() = 0;
    [[nodiscard]] virtual std::string SendAndReceive(
        const std::string& endpoint,
        const std::string& payload,
        const WebSocketHeaders& headers = {},
        std::stop_token stopToken = {}) = 0;
};
}
