#pragma once

#include "shared/network/infrastructure/websocket/WinHttpWebSocketClient.h"

#ifdef _WIN32
#include "shared/network/infrastructure/winhttp/WinHttpHandle.h"
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
}

