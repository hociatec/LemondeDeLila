#include "shared/network/infrastructure/websocket/WinHttpWebSocketClient.h"
#include "shared/network/infrastructure/websocket/WinHttpWebSocketClient.NativeState.h"
#include "shared/network/infrastructure/websocket/WinHttpWebSocketInternals.h"
#include "shared/network/domain/NetworkPolicy.h"
#include "shared/errors/catalog/NetworkErrorMessages.h"
#include "shared/errors/domain/ErrorFormatting.h"
#include "shared/network/domain/WebSocketConstants.h"
#include "shared/text/infrastructure/Utf8ToWide.h"

#include <stdexcept>
#include <string>
#include <chrono>
#include <exception>
#include <memory>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX 1
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
    const auto state = state_;
    if (state->closing.load(std::memory_order_acquire))
        throw std::runtime_error("Previous WebSocket shutdown is still pending.");
    auto handshake = state->operations.Begin(WebSocketOperationPhase::Handshake);
    const auto generation = handshake.generation;
    const auto ensureCurrent = [&]()
    {
        ThrowIfCancelled(stopToken);
        if (state->operations.Generation() != generation)
            throw std::runtime_error("WebSocket operation cancelled.");
    };
    auto finishHandshake = [state, generation, handshake](void*) mutable noexcept
    {
        state->operations.End(handshake);
        if (std::uncaught_exceptions() > 0 &&
            state->operations.CancelIfCurrent(generation))
            ResetTransportState(state);
        if (state->closing.load(std::memory_order_acquire) &&
            state->operations.WaitForIdle(std::chrono::milliseconds(0)))
            ResetTransportState(state);
    };
    const std::unique_ptr<void, decltype(finishHandshake)> handshakeGuard(
        reinterpret_cast<void*>(1),
        finishHandshake);

    const auto parsed = detail::ParseEndpoint(endpoint);
    const auto userAgent = lila::shared::text::Utf8ToWide(std::string(lila::shared::network::UserAgent));

    state->session.Reset(WinHttpOpen(
        userAgent.c_str(),
        WINHTTP_ACCESS_TYPE_NO_PROXY,
        WINHTTP_NO_PROXY_NAME,
        WINHTTP_NO_PROXY_BYPASS,
        0));
    ensureCurrent();
    if (state->session.Get() == nullptr)
    {
        throw std::runtime_error(lila::shared::errors::WinHttpSessionCreationFailed);
    }

    if (!WinHttpSetTimeouts(
            state->session.Get(),
            lila::shared::network::NetworkTimeouts::ResolveAndConnectMs,
            lila::shared::network::NetworkTimeouts::ResolveAndConnectMs,
            lila::shared::network::NetworkTimeouts::SendMs,
            lila::shared::network::NetworkTimeouts::ReceiveMs))
    {
        throw std::runtime_error(lila::shared::errors::WinHttpTimeoutConfigurationFailed);
    }

    state->connection.Reset(WinHttpConnect(state->session.Get(), parsed.host.c_str(), parsed.port, 0));
    ensureCurrent();
    if (state->connection.Get() == nullptr)
    {
        throw std::runtime_error(lila::shared::errors::WinHttpConnectFailed);
    }

    const DWORD requestFlags = parsed.secure ? WINHTTP_FLAG_SECURE : 0;
    state->request.Reset(WinHttpOpenRequest(
        state->connection.Get(),
        L"GET",
        parsed.path.c_str(),
        nullptr,
        WINHTTP_NO_REFERER,
        WINHTTP_DEFAULT_ACCEPT_TYPES,
        requestFlags));
    ensureCurrent();
    if (state->request.Get() == nullptr)
    {
        throw std::runtime_error(lila::shared::errors::WinHttpRequestCreationFailed);
    }

    if (!WinHttpSetOption(state->request.Get(), WINHTTP_OPTION_UPGRADE_TO_WEB_SOCKET, nullptr, 0))
    {
        throw std::runtime_error(lila::shared::errors::WinHttpUpgradeFailed);
    }

    const auto headersBlock = detail::BuildHeadersBlock(headers);
    if (!headersBlock.empty())
    {
        if (!WinHttpAddRequestHeaders(
                state->request.Get(),
                headersBlock.c_str(),
                static_cast<DWORD>(headersBlock.size()),
            WINHTTP_ADDREQ_FLAG_ADD))
        {
            throw std::runtime_error(lila::shared::errors::WinHttpHeadersFailed);
        }
    }

    ensureCurrent();
    if (!WinHttpSendRequest(state->request.Get(), WINHTTP_NO_ADDITIONAL_HEADERS, 0, WINHTTP_NO_REQUEST_DATA, 0, 0, 0))
    {
        // The endpoint may carry a short-lived WebSocket ticket in its query.
        // WinHTTP failures expose only the stable operation, never the URL.
        throw std::runtime_error(lila::shared::errors::WinHttpHandshakeSendFailed);
    }

    ensureCurrent();
    if (!WinHttpReceiveResponse(state->request.Get(), nullptr))
    {
        throw std::runtime_error(lila::shared::errors::WinHttpHandshakeResponseFailed);
    }

    ensureCurrent();
    const DWORD responseStatusCode = detail::QueryResponseStatusCode(state->request.Get());
    if (responseStatusCode != HTTP_STATUS_SWITCH_PROTOCOLS)
    {
        throw std::runtime_error(lila::shared::errors::WithDetails(
            lila::shared::errors::WinHttpUpgradeUnexpectedStatus,
            std::to_string(responseStatusCode)));
    }

    {
        std::scoped_lock lock(state->operationMutex);
        ensureCurrent();
        state->webSocket.Reset(WinHttpWebSocketCompleteUpgrade(state->request.Get(), 0));
    }
    state->request.Reset();
    ensureCurrent();
    if (state->webSocket.Get() == nullptr)
    {
        throw std::runtime_error(lila::shared::errors::WinHttpUpgradeFailed);
    }

    DWORD closeTimeout = lila::shared::network::NetworkTimeouts::WebSocketCloseMs;
    static_cast<void>(WinHttpSetOption(
        state->webSocket.Get(),
        WINHTTP_OPTION_WEB_SOCKET_CLOSE_TIMEOUT,
        &closeTimeout,
        sizeof(closeTimeout)));

    {
        std::scoped_lock lock(state->metadataMutex);
        state->endpoint = endpoint;
        state->headers = headers;
    }
    state->acceptingOperations.store(true, std::memory_order_release);
#else
    (void)endpoint;
    (void)headers;
    throw std::runtime_error(lila::shared::errors::WinHttpUnsupportedTransport);
#endif
}
}
