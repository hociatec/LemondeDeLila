#pragma once

#include <map>
#include <memory>
#include <string>

#include "shared/network/websocket/IWebSocketClient.h"

namespace lila::shared::network::websocket
{
class WinHttpWebSocketClient final : public IWebSocketClient
{
public:
    WinHttpWebSocketClient();
    ~WinHttpWebSocketClient();

    WinHttpWebSocketClient(const WinHttpWebSocketClient&) = delete;
    WinHttpWebSocketClient& operator=(const WinHttpWebSocketClient&) = delete;

    void Connect(const std::string& endpoint, const WebSocketHeaders& headers = {}) override;
    void Close() override;
    [[nodiscard]] bool IsConnected() const override;
    [[nodiscard]] bool IsConnectedTo(const std::string& endpoint, const WebSocketHeaders& headers = {}) const override;
    void Send(const std::string& payload) override;
    [[nodiscard]] std::string Receive() override;
    [[nodiscard]] std::string SendAndReceive(
        const std::string& endpoint,
        const std::string& payload,
        const WebSocketHeaders& headers = {},
        std::stop_token stopToken = {}) override;

private:
    struct NativeState;
    std::unique_ptr<NativeState> state_;
};
}
