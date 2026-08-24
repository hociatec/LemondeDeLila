#include "shared/network/infrastructure/websocket/WinHttpWebSocketClient.h"
#include "shared/network/infrastructure/websocket/WinHttpWebSocketInternals.h"
#include "shared/network/domain/NetworkPolicy.h"
#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/network/domain/WebSocketConstants.h"
#include "shared/text/presentation/encoding/Encoding.h"
#ifdef _WIN32
#include "shared/network/infrastructure/winhttp/WinHttpHandle.h"
#endif
#include <stdexcept>
#include <string>
#include <utility>

#ifdef _WIN32
#include <windows.h>
#include <winhttp.h>
#endif
namespace lila::shared::network::websocket
{
struct WinHttpWebSocketClient::NativeState
{
#ifdef _WIN32
    lila::shared::network::winhttp::Handle session;
    lila::shared::network::winhttp::Handle connection;
    lila::shared::network::winhttp::Handle request;
    lila::shared::network::winhttp::Handle webSocket;
#endif
    std::string endpoint;
    WebSocketHeaders headers;
};

WinHttpWebSocketClient::WinHttpWebSocketClient()
    : state_(std::make_unique<NativeState>())
{
}

WinHttpWebSocketClient::~WinHttpWebSocketClient()
{
    Close();
}

void WinHttpWebSocketClient::Connect(
    const std::string& endpoint,
    const WebSocketHeaders& headers,
    std::stop_token stopToken)
{
#ifdef _WIN32
    ThrowIfCancelled(stopToken);
    if (IsConnectedTo(endpoint, headers))
    {
        return;
    }

    Close();

    const auto parsed = detail::ParseEndpoint(endpoint);
    const auto userAgent = lila::shared::text::Utf8ToWide(std::string(lila::shared::network::UserAgent));

    state_->session.Reset(WinHttpOpen(
        userAgent.c_str(),
        WINHTTP_ACCESS_TYPE_NO_PROXY,
        WINHTTP_NO_PROXY_NAME,
        WINHTTP_NO_PROXY_BYPASS,
        0));
    ThrowIfCancelled(stopToken);
    if (state_->session.Get() == nullptr)
    {
        throw std::runtime_error(lila::shared::errors::WinHttpSessionCreationFailed);
    }

    if (!WinHttpSetTimeouts(
            state_->session.Get(),
            lila::shared::network::NetworkTimeouts::ResolveAndConnectMs,
            lila::shared::network::NetworkTimeouts::ResolveAndConnectMs,
            lila::shared::network::NetworkTimeouts::SendMs,
            lila::shared::network::NetworkTimeouts::ReceiveMs))
    {
        throw std::runtime_error(lila::shared::errors::WinHttpTimeoutConfigurationFailed);
    }

    state_->connection.Reset(WinHttpConnect(state_->session.Get(), parsed.host.c_str(), parsed.port, 0));
    ThrowIfCancelled(stopToken);
    if (state_->connection.Get() == nullptr)
    {
        Close();
        throw std::runtime_error(lila::shared::errors::WinHttpConnectFailed);
    }

    const DWORD requestFlags = parsed.secure ? WINHTTP_FLAG_SECURE : 0;
    state_->request.Reset(WinHttpOpenRequest(
        state_->connection.Get(),
        L"GET",
        parsed.path.c_str(),
        nullptr,
        WINHTTP_NO_REFERER,
        WINHTTP_DEFAULT_ACCEPT_TYPES,
        requestFlags));
    ThrowIfCancelled(stopToken);
    if (state_->request.Get() == nullptr)
    {
        Close();
        throw std::runtime_error(lila::shared::errors::WinHttpRequestCreationFailed);
    }

    if (!WinHttpSetOption(state_->request.Get(), WINHTTP_OPTION_UPGRADE_TO_WEB_SOCKET, nullptr, 0))
    {
        Close();
        throw std::runtime_error(lila::shared::errors::WinHttpUpgradeFailed);
    }

    const auto headersBlock = detail::BuildHeadersBlock(headers);
    if (!headersBlock.empty())
    {
        if (!WinHttpAddRequestHeaders(
                state_->request.Get(),
                headersBlock.c_str(),
                static_cast<DWORD>(headersBlock.size()),
            WINHTTP_ADDREQ_FLAG_ADD))
        {
            Close();
            throw std::runtime_error(lila::shared::errors::WinHttpHeadersFailed);
        }
    }

    ThrowIfCancelled(stopToken);
    if (!WinHttpSendRequest(state_->request.Get(), WINHTTP_NO_ADDITIONAL_HEADERS, 0, WINHTTP_NO_REQUEST_DATA, 0, 0, 0))
    {
        Close();
        throw std::runtime_error(lila::shared::errors::WithDetails(lila::shared::errors::WinHttpHandshakeSendFailed, endpoint));
    }

    ThrowIfCancelled(stopToken);
    if (!WinHttpReceiveResponse(state_->request.Get(), nullptr))
    {
        Close();
        throw std::runtime_error(lila::shared::errors::WithDetails(lila::shared::errors::WinHttpHandshakeResponseFailed, endpoint));
    }

    ThrowIfCancelled(stopToken);
    const DWORD responseStatusCode = detail::QueryResponseStatusCode(state_->request.Get());
    if (responseStatusCode != HTTP_STATUS_SWITCH_PROTOCOLS)
    {
        Close();
        throw std::runtime_error(lila::shared::errors::WithDetails(
            lila::shared::errors::WinHttpUpgradeUnexpectedStatus,
            std::to_string(responseStatusCode)));
    }

    state_->webSocket.Reset(WinHttpWebSocketCompleteUpgrade(state_->request.Get(), 0));
    state_->request.Reset();
    ThrowIfCancelled(stopToken);
    if (state_->webSocket.Get() == nullptr)
    {
        Close();
        throw std::runtime_error(lila::shared::errors::WinHttpUpgradeFailed);
    }

    state_->endpoint = endpoint;
    state_->headers = headers;
#else
    (void)endpoint;
    (void)headers;
    throw std::runtime_error(lila::shared::errors::WinHttpUnsupportedTransport);
#endif
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

void WinHttpWebSocketClient::Send(const std::string& payload)
{
#ifdef _WIN32
    if (!IsConnected())
    {
        throw std::runtime_error(lila::shared::errors::WinHttpNoActiveConnection);
    }

    const auto rawPayload = reinterpret_cast<const BYTE*>(payload.data());
    const DWORD sendResult = WinHttpWebSocketSend(
        state_->webSocket.Get(),
        WINHTTP_WEB_SOCKET_UTF8_MESSAGE_BUFFER_TYPE,
        const_cast<BYTE*>(rawPayload),
        static_cast<DWORD>(payload.size()));
    if (sendResult != NO_ERROR)
    {
        Close();
        throw std::runtime_error(lila::shared::errors::WithDetails(
            lila::shared::errors::RealtimeSendFailed,
            "code WinHTTP " + std::to_string(sendResult)));
    }
#else
    (void)payload;
    throw std::runtime_error(lila::shared::errors::WinHttpUnsupportedTransport);
#endif
}

std::string WinHttpWebSocketClient::Receive()
{
#ifdef _WIN32
    if (!IsConnected())
    {
        throw std::runtime_error(lila::shared::errors::WinHttpNoActiveConnection);
    }

    try
    {
        return detail::ReceiveMessage(state_->webSocket.Get());
    }
    catch (const std::exception& exception)
    {
        (void)exception;
        Close();
        throw;
    }
#else
    throw std::runtime_error(lila::shared::errors::WinHttpUnsupportedTransport);
#endif
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
