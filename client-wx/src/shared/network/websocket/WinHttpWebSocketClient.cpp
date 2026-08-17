#include "shared/network/websocket/WinHttpWebSocketClient.h"
#include "shared/network/NetworkPolicy.h"
#include "shared/text/Encoding.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/contracts/BackendWsContracts.h"

#include <array>
#include <cstdint>
#include <map>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

#ifdef _WIN32
#include <windows.h>
#include <winhttp.h>
#endif

namespace
{
#ifdef _WIN32
struct ParsedEndpoint
{
    std::wstring host;
    std::wstring path;
    std::wstring query;
    INTERNET_PORT port = 0;
    bool secure = false;
};

std::string NormalizeEndpointForWinHttp(const std::string& endpoint)
{
    if (endpoint.rfind(std::string(lila::shared::contracts::ws::WsScheme), 0) == 0)
    {
        return std::string(lila::shared::contracts::ws::HttpScheme) +
            endpoint.substr(std::string(lila::shared::contracts::ws::WsScheme).size());
    }

    if (endpoint.rfind(std::string(lila::shared::contracts::ws::WssScheme), 0) == 0)
    {
        return std::string(lila::shared::contracts::ws::HttpsScheme) +
            endpoint.substr(std::string(lila::shared::contracts::ws::WssScheme).size());
    }

    return endpoint;
}

ParsedEndpoint ParseEndpoint(const std::string& endpoint)
{
    const bool secure =
        endpoint.rfind(std::string(lila::shared::contracts::ws::WssScheme), 0) == 0 ||
        endpoint.rfind(std::string(lila::shared::contracts::ws::HttpsScheme), 0) == 0;
    const auto normalizedEndpoint = NormalizeEndpointForWinHttp(endpoint);
    const auto endpointWide = lila::shared::text::Utf8ToWide(normalizedEndpoint);
    URL_COMPONENTS components{};
    std::array<wchar_t, 256> hostBuffer{};
    std::array<wchar_t, 2048> pathBuffer{};
    std::array<wchar_t, 1024> queryBuffer{};

    components.dwStructSize = sizeof(components);
    components.lpszHostName = hostBuffer.data();
    components.dwHostNameLength = static_cast<DWORD>(hostBuffer.size());
    components.lpszUrlPath = pathBuffer.data();
    components.dwUrlPathLength = static_cast<DWORD>(pathBuffer.size());
    components.lpszExtraInfo = queryBuffer.data();
    components.dwExtraInfoLength = static_cast<DWORD>(queryBuffer.size());

    if (!WinHttpCrackUrl(endpointWide.c_str(), 0, 0, &components))
    {
        throw std::runtime_error(lila::shared::errors::WinHttpEndpointParseFailed);
    }

    ParsedEndpoint parsed;
    parsed.host.assign(components.lpszHostName, components.dwHostNameLength);
    parsed.path.assign(components.lpszUrlPath, components.dwUrlPathLength);
    parsed.query.assign(components.lpszExtraInfo, components.dwExtraInfoLength);
    parsed.port = components.nPort;
    parsed.secure = secure;

    if (parsed.path.empty())
    {
        parsed.path = L"/";
    }

    if (!parsed.query.empty())
    {
        parsed.path += parsed.query;
    }

    return parsed;
}

class WinHttpHandle final
{
public:
    WinHttpHandle() = default;
    explicit WinHttpHandle(HINTERNET handle) : handle_(handle) {}
    ~WinHttpHandle()
    {
        Reset();
    }

    WinHttpHandle(const WinHttpHandle&) = delete;
    WinHttpHandle& operator=(const WinHttpHandle&) = delete;

    WinHttpHandle(WinHttpHandle&& other) noexcept : handle_(other.Release()) {}

    WinHttpHandle& operator=(WinHttpHandle&& other) noexcept
    {
        if (this != &other)
        {
            Reset(other.Release());
        }

        return *this;
    }

    [[nodiscard]] HINTERNET Get() const
    {
        return handle_;
    }

    [[nodiscard]] HINTERNET Release()
    {
        HINTERNET released = handle_;
        handle_ = nullptr;
        return released;
    }

    void Reset(HINTERNET handle = nullptr)
    {
        if (handle_ != nullptr)
        {
            WinHttpCloseHandle(handle_);
        }

        handle_ = handle;
    }

private:
    HINTERNET handle_ = nullptr;
};

std::string ReceiveMessage(HINTERNET webSocketHandle)
{
    std::vector<char> payload;
    payload.reserve(4096);
    std::array<std::uint8_t, 4096> buffer{};

    while (true)
    {
        DWORD bytesRead = 0;
        WINHTTP_WEB_SOCKET_BUFFER_TYPE bufferType = WINHTTP_WEB_SOCKET_UTF8_FRAGMENT_BUFFER_TYPE;

        const DWORD result = WinHttpWebSocketReceive(
            webSocketHandle,
            buffer.data(),
            static_cast<DWORD>(buffer.size()),
            &bytesRead,
            &bufferType);

        if (result != NO_ERROR)
        {
            throw std::runtime_error(lila::shared::errors::WinHttpReceiveFailed);
        }

        if (bufferType == WINHTTP_WEB_SOCKET_CLOSE_BUFFER_TYPE)
        {
            throw std::runtime_error(lila::shared::errors::WinHttpSocketClosed);
        }

        payload.insert(payload.end(), buffer.begin(), buffer.begin() + bytesRead);

        if (bufferType == WINHTTP_WEB_SOCKET_UTF8_MESSAGE_BUFFER_TYPE ||
            bufferType == WINHTTP_WEB_SOCKET_BINARY_MESSAGE_BUFFER_TYPE)
        {
            break;
        }
    }

    return std::string(payload.begin(), payload.end());
}

std::wstring BuildHeadersBlock(const lila::shared::network::websocket::WebSocketHeaders& headers)
{
    std::wstring block;
    for (const auto& [key, value] : headers)
    {
        if (key.empty() || value.empty())
        {
            continue;
        }

        block += lila::shared::text::Utf8ToWide(key);
        block += L": ";
        block += lila::shared::text::Utf8ToWide(value);
        block += L"\r\n";
    }

    return block;
}
#endif
}

namespace lila::shared::network::websocket
{
struct WinHttpWebSocketClient::NativeState
{
#ifdef _WIN32
    WinHttpHandle session;
    WinHttpHandle connection;
    WinHttpHandle webSocket;
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

    const auto parsed = ParseEndpoint(endpoint);
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
    WinHttpHandle request(WinHttpOpenRequest(
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

    const auto headersBlock = BuildHeadersBlock(headers);
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

    state_->webSocket.Reset(WinHttpWebSocketCompleteUpgrade(request.Get(), 0));
    if (state_->webSocket.Get() == nullptr)
    {
        Close();
        throw std::runtime_error(lila::shared::errors::WinHttpUpgradeFailed);
    }

    (void)request.Release();
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
        throw std::runtime_error(lila::shared::errors::RealtimeSendFailed);
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
        return ReceiveMessage(state_->webSocket.Get());
    }
    catch (...)
    {
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
    const WebSocketHeaders& headers)
{
    Connect(endpoint, headers);
    Send(payload);
    return Receive();
}
}

