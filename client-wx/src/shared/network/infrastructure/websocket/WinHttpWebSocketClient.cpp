#include "shared/network/infrastructure/websocket/WinHttpWebSocketClient.h"
#include "shared/network/infrastructure/websocket/WinHttpWebSocketClient.NativeState.h"
#include "shared/errors/catalog/ErrorMessages.h"

#include <stdexcept>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <winhttp.h>
#endif

namespace lila::shared::network::websocket
{
WinHttpWebSocketClient::WinHttpWebSocketClient()
    : state_(std::make_unique<NativeState>())
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
    return state_ != nullptr && state_->webSocket.Get() != nullptr;
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
    ++state_->generation;
    ResetTransport();
}

void WinHttpWebSocketClient::CancelIfCurrent(std::uint64_t generation) noexcept
{
    if (state_ == nullptr) return;
    auto expected = generation;
    if (!state_->generation.compare_exchange_strong(expected, generation + 1)) return;
    ResetTransport();
}

WinHttpWebSocketClient::OperationTicket WinHttpWebSocketClient::BeginOperation(bool receive)
{
    if (state_ == nullptr) return {};
    std::scoped_lock lock(state_->operationMutex);
    auto* handle = state_->webSocket.Get();
    if (handle == nullptr) return {};
    if (receive) ++state_->activeReceives;
    else ++state_->activeSends;
    return {handle, state_->generation.load(), receive};
}

void WinHttpWebSocketClient::EndOperation(const OperationTicket& ticket) noexcept
{
    if (state_ == nullptr || ticket.handle == nullptr) return;
    {
        std::scoped_lock lock(state_->operationMutex);
        auto& count = ticket.receive ? state_->activeReceives : state_->activeSends;
        if (count > 0) --count;
    }
    state_->operationFinished.notify_all();
}

void WinHttpWebSocketClient::ResetTransport() noexcept
{
#ifdef _WIN32
    if (state_ == nullptr) return;
    std::scoped_lock closeLock(state_->closeMutex);

    HINTERNET webSocket = nullptr;
    {
        std::unique_lock lock(state_->operationMutex);
        webSocket = state_->webSocket.Release();
        state_->operationFinished.wait(lock, [this]()
        {
            return state_->activeSends == 0 && state_->activeHandshakes == 0;
        });
    }
    if (webSocket != nullptr)
    {
        // The close frame wakes a synchronous Receive. The native handle is
        // released only after every API call using it has returned.
        static_cast<void>(WinHttpWebSocketClose(
            webSocket,
            WINHTTP_WEB_SOCKET_SUCCESS_CLOSE_STATUS,
            nullptr,
            0));
        {
            std::unique_lock lock(state_->operationMutex);
            state_->operationFinished.wait(lock, [this]() { return state_->activeReceives == 0; });
        }
        WinHttpCloseHandle(webSocket);
    }
    state_->request.Reset();
    state_->connection.Reset();
    state_->session.Reset();
#endif
    if (state_ != nullptr)
    {
        std::scoped_lock lock(state_->metadataMutex);
        state_->endpoint.clear();
        state_->headers.clear();
    }
}

void WinHttpWebSocketClient::ThrowIfCancelled(std::stop_token stopToken)
{
    if (stopToken.stop_requested())
    {
        throw std::runtime_error("WebSocket operation cancelled.");
    }
}
}
