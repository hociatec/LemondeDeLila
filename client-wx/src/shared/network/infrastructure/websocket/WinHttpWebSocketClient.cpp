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
#ifdef _WIN32
    if (state_ != nullptr)
    {
        auto* webSocket = state_->webSocket.Release();
        if (webSocket != nullptr)
        {
            WinHttpWebSocketClose(
                webSocket,
                WINHTTP_WEB_SOCKET_SUCCESS_CLOSE_STATUS,
                nullptr,
                0);
            WinHttpCloseHandle(webSocket);
        }
    }

    if (state_ != nullptr)
    {
        state_->request.Reset();
        state_->connection.Reset();
        state_->session.Reset();
        state_->endpoint.clear();
        state_->headers.clear();
    }
#endif
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
    return IsConnected() && state_->endpoint == endpoint && state_->headers == headers;
}

void WinHttpWebSocketClient::CancelPendingOperation() noexcept
{
#ifdef _WIN32
    if (state_ != nullptr)
    {
        state_->webSocket.Reset();
        state_->request.Reset();
        state_->connection.Reset();
        state_->session.Reset();
    }
#endif
}

void WinHttpWebSocketClient::ThrowIfCancelled(std::stop_token stopToken)
{
    if (stopToken.stop_requested())
    {
        CancelPendingOperation();
        throw std::runtime_error("WebSocket operation cancelled.");
    }
}
}
