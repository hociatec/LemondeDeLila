#pragma once

#include "shared/network/application/websocket/IWebSocketClient.h"

#include <string>

#ifdef _WIN32
#include <windows.h>
#include <winhttp.h>
#endif

namespace lila::shared::network::websocket::detail
{
#ifdef _WIN32
struct ParsedEndpoint final
{
    std::wstring host;
    std::wstring path;
    std::wstring query;
    INTERNET_PORT port = 0;
    bool secure = false;
};

[[nodiscard]] ParsedEndpoint ParseEndpoint(const std::string& endpoint);
[[nodiscard]] DWORD QueryResponseStatusCode(HINTERNET requestHandle);
[[nodiscard]] std::string ReceiveMessage(HINTERNET webSocketHandle);
[[nodiscard]] std::wstring BuildHeadersBlock(const WebSocketHeaders& headers);
#endif
}
