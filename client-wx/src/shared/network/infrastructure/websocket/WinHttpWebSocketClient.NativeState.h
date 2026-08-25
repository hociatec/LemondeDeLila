#pragma once

#include "shared/network/infrastructure/websocket/WinHttpWebSocketClient.h"

#include <atomic>
#include <condition_variable>
#include <cstdint>
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
    std::atomic<std::uint64_t> generation{0};
    std::mutex closeMutex;
    std::mutex operationMutex;
    std::condition_variable operationFinished;
    std::size_t activeReceives = 0;
    std::size_t activeSends = 0;
    std::size_t activeHandshakes = 0;
    mutable std::mutex metadataMutex;
    std::string endpoint;
    WebSocketHeaders headers;
};
}
