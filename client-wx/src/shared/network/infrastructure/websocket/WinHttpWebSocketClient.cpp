#include "shared/network/infrastructure/websocket/WinHttpWebSocketClient.h"
#include "shared/network/infrastructure/websocket/WinHttpWebSocketClient.NativeState.h"
#include "shared/network/domain/NetworkPolicy.h"

#include <chrono>
#include <stdexcept>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX 1
#include <windows.h>
#include <winhttp.h>
#endif

namespace lila::shared::network::websocket
{
WinHttpWebSocketClient::WinHttpWebSocketClient()
    : state_(std::make_shared<NativeState>())
{
}
WinHttpWebSocketClient::~WinHttpWebSocketClient()
{
    Close();
}

void WinHttpWebSocketClient::Close()
{
    CancelPendingOperation();
}

bool WinHttpWebSocketClient::IsConnected() const
{
#ifdef _WIN32
    return state_ != nullptr &&
        state_->acceptingOperations.load(std::memory_order_acquire) &&
        state_->webSocket.Get() != nullptr;
#else
    return false;
#endif
}

bool WinHttpWebSocketClient::IsConnectedTo(const std::string& endpoint, const WebSocketHeaders& headers) const
{
    if (!IsConnected()) return false;
    std::scoped_lock lock(state_->metadataMutex);
    return IsConnected() && state_->endpoint == endpoint && state_->headers == headers;
}

void WinHttpWebSocketClient::CancelPendingOperation() noexcept
{
    if (state_ == nullptr) return;
    static_cast<void>(state_->operations.Cancel());
    ResetTransport();
}

void WinHttpWebSocketClient::CancelIfCurrent(std::uint64_t generation) noexcept
{
    if (state_ == nullptr) return;
    if (!state_->operations.CancelIfCurrent(generation)) return;
    ResetTransport();
}

WinHttpWebSocketClient::OperationTicket WinHttpWebSocketClient::BeginOperation(bool receive)
{
    if (state_ == nullptr) return {};
    std::scoped_lock lock(state_->operationMutex);
    if (!state_->acceptingOperations.load(std::memory_order_acquire)) return {};
    auto* handle = state_->webSocket.Get();
    if (handle == nullptr) return {};
    const auto phase = receive
        ? WebSocketOperationPhase::Receive : WebSocketOperationPhase::Send;
    auto gate = state_->operations.Begin(phase);
    return {handle, gate.generation, state_, gate};
}

void WinHttpWebSocketClient::EndOperation(OperationTicket& ticket) noexcept
{
    if (ticket.state == nullptr || ticket.handle == nullptr) return;
    const auto state = ticket.state;
    state->operations.End(ticket.gate);
    ticket.handle = nullptr;
    if (state->closing.load(std::memory_order_acquire) &&
        state->operations.WaitForIdle(std::chrono::milliseconds(0)))
        ResetTransportState(state);
}

void WinHttpWebSocketClient::ResetTransport() noexcept
{
    ResetTransportState(state_);
}

void WinHttpWebSocketClient::ResetTransportState(
    const std::shared_ptr<NativeState>& state) noexcept
{
#ifdef _WIN32
    if (state == nullptr) return;
    const bool alreadyClosing = state->closing.exchange(true, std::memory_order_acq_rel);
    state->acceptingOperations.store(false, std::memory_order_release);
    if (alreadyClosing &&
        !state->operations.WaitForIdle(std::chrono::milliseconds(0))) return;
    std::scoped_lock closeLock(state->closeMutex);

    HINTERNET webSocket = nullptr;
    {
        std::scoped_lock lock(state->operationMutex);
        webSocket = state->webSocket.Get();
    }
    const auto timeout = std::chrono::milliseconds(
        lila::shared::network::NetworkTimeouts::WebSocketCloseMs);
    if (!state->operations.WaitForIdle(timeout, false)) return;
    if (webSocket != nullptr)
    {
        // Shutdown uses only the send side and is allowed concurrently with
        // Receive. Full close and handle destruction wait for Receive to end.
        static_cast<void>(WinHttpWebSocketShutdown(
            webSocket,
            WINHTTP_WEB_SOCKET_SUCCESS_CLOSE_STATUS,
            nullptr,
            0));
        if (!state->operations.WaitForIdle(timeout)) return;
        std::scoped_lock lock(state->operationMutex);
        if (state->webSocket.Get() == webSocket)
        {
            static_cast<void>(WinHttpWebSocketClose(
                webSocket, WINHTTP_WEB_SOCKET_SUCCESS_CLOSE_STATUS, nullptr, 0));
            state->webSocket.Reset();
        }
    }
    state->request.Reset();
    state->connection.Reset();
    state->session.Reset();
#endif
    if (state != nullptr)
    {
        std::scoped_lock lock(state->metadataMutex);
        state->endpoint.clear();
        state->headers.clear();
    }
    if (state != nullptr) state->closing.store(false, std::memory_order_release);
}

void WinHttpWebSocketClient::ThrowIfCancelled(std::stop_token stopToken)
{
    if (stopToken.stop_requested())
    {
        throw std::runtime_error("WebSocket operation cancelled.");
    }
}
}
