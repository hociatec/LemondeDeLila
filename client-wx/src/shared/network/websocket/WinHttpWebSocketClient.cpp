#include "shared/network/websocket/WinHttpWebSocketClient.h"
#include "shared/network/websocket/WinHttpWebSocketInternals.h"
#include "shared/network/NetworkPolicy.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/network/WebSocketConstants.h"
#include "shared/text/Encoding.h"
#ifdef _WIN32
#include "shared/network/winhttp/WinHttpHandle.h"
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

void WinHttpWebSocketClient::Connect(const std::string& endpoint, const WebSocketHeaders& headers)
{
#ifdef _WIN32
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
    if (state_->connection.Get() == nullptr)
    {
        Close();
        throw std::runtime_error(lila::shared::errors::WinHttpConnectFailed);
    }

    const DWORD requestFlags = parsed.secure ? WINHTTP_FLAG_SECURE : 0;
    lila::shared::network::winhttp::Handle request(WinHttpOpenRequest(
        state_->connection.Get(),
        L"GET",
        parsed.path.c_str(),
        nullptr,
        WINHTTP_NO_REFERER,
        WINHTTP_DEFAULT_ACCEPT_TYPES,
        requestFlags));
    if (request.Get() == nullptr)
    {
        Close();
        throw std::runtime_error(lila::shared::errors::WinHttpRequestCreationFailed);
    }

    if (!WinHttpSetOption(request.Get(), WINHTTP_OPTION_UPGRADE_TO_WEB_SOCKET, nullptr, 0))
    {
        Close();
        throw std::runtime_error(lila::shared::errors::WinHttpUpgradeFailed);
    }

    const auto headersBlock = detail::BuildHeadersBlock(headers);
    if (!headersBlock.empty())
    {
        if (!WinHttpAddRequestHeaders(
                request.Get(),
                headersBlock.c_str(),
                static_cast<DWORD>(headersBlock.size()),
            WINHTTP_ADDREQ_FLAG_ADD))
        {
            Close();
            throw std::runtime_error(lila::shared::errors::WinHttpHeadersFailed);
        }
    }

    if (!WinHttpSendRequest(request.Get(), WINHTTP_NO_ADDITIONAL_HEADERS, 0, WINHTTP_NO_REQUEST_DATA, 0, 0, 0))
    {
        Close();
        throw std::runtime_error(lila::shared::errors::WithDetails(lila::shared::errors::WinHttpHandshakeSendFailed, endpoint));
    }

    if (!WinHttpReceiveResponse(request.Get(), nullptr))
    {
        Close();
        throw std::runtime_error(lila::shared::errors::WithDetails(lila::shared::errors::WinHttpHandshakeResponseFailed, endpoint));
    }

    const DWORD responseStatusCode = detail::QueryResponseStatusCode(request.Get());
    if (responseStatusCode != HTTP_STATUS_SWITCH_PROTOCOLS)
    {
        Close();
        throw std::runtime_error(lila::shared::errors::WithDetails(
            lila::shared::errors::WinHttpUpgradeUnexpectedStatus,
            std::to_string(responseStatusCode)));
    }

    state_->webSocket.Reset(WinHttpWebSocketCompleteUpgrade(request.Get(), 0));
    if (state_->webSocket.Get() == nullptr)
    {
        Close();
        throw std::runtime_error(lila::shared::errors::WinHttpUpgradeFailed);
    }

    // The upgraded WebSocket has its own HINTERNET handle. The HTTP request
    // remains a distinct WinHTTP handle and is closed automatically here by
    // the RAII wrapper when this scope ends.
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
    if (state_ != nullptr && state_->webSocket.Get() != nullptr)
    {
        WinHttpWebSocketClose(state_->webSocket.Get(), WINHTTP_WEB_SOCKET_SUCCESS_CLOSE_STATUS, nullptr, 0);
    }

    if (state_ != nullptr)
    {
        state_->webSocket.Reset();
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

std::string WinHttpWebSocketClient::SendAndReceive(
    const std::string& endpoint,
    const std::string& payload,
    const WebSocketHeaders& headers,
    std::stop_token stopToken)
{
    Connect(endpoint, headers);
    if (stopToken.stop_requested())
    {
        Close();
        throw std::runtime_error("WebSocket operation cancelled.");
    }

    Send(payload);
    std::stop_callback cancelReceive(
        stopToken,
        [this]()
        {
#ifdef _WIN32
            if (state_ != nullptr)
            {
                state_->webSocket.Reset();
            }
#endif
        });
    return Receive();
}
}
