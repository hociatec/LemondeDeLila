#include "shared/network/infrastructure/websocket/WinHttpWebSocketClient.h"
#include "shared/network/infrastructure/websocket/WinHttpWebSocketClient.NativeState.h"
#include "shared/network/infrastructure/websocket/WinHttpWebSocketInternals.h"
#include "shared/network/domain/NetworkPolicy.h"
#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/network/domain/WebSocketConstants.h"
#include "shared/text/presentation/encoding/Encoding.h"

#include <stdexcept>
#include <string>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <winhttp.h>
#endif

namespace lila::shared::network::websocket
{
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
}

