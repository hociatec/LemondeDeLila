#include "shared/network/websocket/WinHttpWebSocketInternals.h"

#include "shared/errors/ErrorMessages.h"
#include "shared/network/WebSocketConstants.h"
#include "shared/text/Encoding.h"

#include <array>
#include <cstdint>
#include <stdexcept>
#include <string>
#include <vector>

namespace lila::shared::network::websocket::detail
{
#ifdef _WIN32
namespace
{
std::string NormalizeEndpointForWinHttp(const std::string& endpoint)
{
    if (endpoint.rfind(std::string(lila::shared::network::ws::WsScheme), 0) == 0)
    {
        return std::string(lila::shared::network::ws::HttpScheme)
            + endpoint.substr(std::string(lila::shared::network::ws::WsScheme).size());
    }

    if (endpoint.rfind(std::string(lila::shared::network::ws::WssScheme), 0) == 0)
    {
        return std::string(lila::shared::network::ws::HttpsScheme)
            + endpoint.substr(std::string(lila::shared::network::ws::WssScheme).size());
    }

    return endpoint;
}
}

ParsedEndpoint ParseEndpoint(const std::string& endpoint)
{
    const bool secure =
        endpoint.rfind(std::string(lila::shared::network::ws::WssScheme), 0) == 0 ||
        endpoint.rfind(std::string(lila::shared::network::ws::HttpsScheme), 0) == 0;
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

DWORD QueryResponseStatusCode(HINTERNET requestHandle)
{
    DWORD statusCode = 0;
    DWORD statusCodeSize = sizeof(statusCode);
    if (!WinHttpQueryHeaders(
            requestHandle,
            WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
            WINHTTP_HEADER_NAME_BY_INDEX,
            &statusCode,
            &statusCodeSize,
            WINHTTP_NO_HEADER_INDEX))
    {
        throw std::runtime_error(lila::shared::errors::WinHttpHandshakeResponseFailed);
    }

    return statusCode;
}

std::string ReceiveMessage(HINTERNET webSocketHandle)
{
    std::vector<char> payload;
    payload.reserve(4096);
    std::array<std::uint8_t, 4096> buffer{};

    auto buildCloseErrorMessage = [](HINTERNET handle) -> std::string
    {
        USHORT closeStatus = 0;
        std::array<char, WINHTTP_WEB_SOCKET_MAX_CLOSE_REASON_LENGTH> closeReason{};
        DWORD reasonLength = 0;

        const DWORD queryResult = WinHttpWebSocketQueryCloseStatus(
            handle,
            &closeStatus,
            closeReason.data(),
            static_cast<DWORD>(closeReason.size()),
            &reasonLength);

        if (queryResult != NO_ERROR)
        {
            return lila::shared::errors::WinHttpSocketClosed;
        }

        if (reasonLength == 0)
        {
            return std::string(lila::shared::errors::WinHttpSocketClosed)
                + " (close status " + std::to_string(closeStatus) + ").";
        }

        return std::string(closeReason.data(), reasonLength);
    };

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
            throw std::runtime_error(buildCloseErrorMessage(webSocketHandle));
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

std::wstring BuildHeadersBlock(const WebSocketHeaders& headers)
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
