#pragma once

#include <map>
#include <memory>
#include <cstdint>
#include <string>

#include "shared/network/application/websocket/IWebSocketClient.h"
#include "shared/network/application/websocket/WebSocketOperationGate.h"

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
    struct NativeState;
    struct OperationTicket final
    {
        void* handle = nullptr;
        std::uint64_t generation = 0;
        std::shared_ptr<NativeState> state;
        WebSocketOperationGate::Ticket gate;
    };

    static void ThrowIfCancelled(std::stop_token stopToken);
    void ResetTransport() noexcept;
    static void ResetTransportState(const std::shared_ptr<NativeState>& state) noexcept;
    void CancelIfCurrent(std::uint64_t generation) noexcept;
    [[nodiscard]] OperationTicket BeginOperation(bool receive);
    void EndOperation(OperationTicket& ticket) noexcept;

    std::shared_ptr<NativeState> state_;
};
}
