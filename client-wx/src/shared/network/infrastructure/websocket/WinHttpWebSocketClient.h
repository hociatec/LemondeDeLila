#pragma once

#include <map>
#include <memory>
#include <cstdint>
#include <string>

#include "shared/network/application/websocket/IWebSocketClient.h"

namespace lila::shared::network::websocket
{
class WinHttpWebSocketClient final : public IWebSocketClient
{
public:
    WinHttpWebSocketClient();
    ~WinHttpWebSocketClient();

    WinHttpWebSocketClient(const WinHttpWebSocketClient&) = delete;
    WinHttpWebSocketClient& operator=(const WinHttpWebSocketClient&) = delete;

    void Connect(
        const std::string& endpoint,
        const WebSocketHeaders& headers = {},
        std::stop_token stopToken = {}) override;
    void Close() override;
    void CancelPendingOperation() noexcept override;
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
    struct OperationTicket final
    {
        void* handle = nullptr;
        std::uint64_t generation = 0;
        bool receive = false;
    };

    void ThrowIfCancelled(std::stop_token stopToken);
    void ResetTransport() noexcept;
    void CancelIfCurrent(std::uint64_t generation) noexcept;
    [[nodiscard]] OperationTicket BeginOperation(bool receive);
    void EndOperation(const OperationTicket& ticket) noexcept;

    struct NativeState;
    std::unique_ptr<NativeState> state_;
};
}
