#pragma once

#include "shared/network/infrastructure/websocket/WinHttpWebSocketClient.h"
#include "shared/network/application/websocket/WebSocketOperationGate.h"

#include <atomic>
#include <mutex>

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
    WebSocketOperationGate operations;
    std::atomic_bool closing{false};
    std::atomic_bool acceptingOperations{false};
    std::mutex closeMutex;
    std::mutex operationMutex;
    mutable std::mutex metadataMutex;
    std::string endpoint;
    WebSocketHeaders headers;
};
}
