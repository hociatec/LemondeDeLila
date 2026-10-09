#include <chrono>
#include <iostream>
#include <string>
#include <nlohmann/json.hpp>
#include "shared/network/application/realtime/AuthenticatedRealtimeApiClient.h"
#include "shared/network/infrastructure/websocket/WinHttpWebSocketClient.h"
#include "shared/network/infrastructure/http/WsTicketProvider.h"

int main(int argc, char** argv)
{
    if (argc != 2) return 2;
    using namespace lila::shared::network;
    websocket::WinHttpWebSocketClient socket;
    http::WsTicketProvider tickets(argv[1]);
    realtime::AuthenticatedRealtimeApiClient client(argv[1], "performance-test", socket, tickets);
    nlohmann::json timings = nlohmann::json::array();
    for (int index = 0; index < 8; ++index)
    {
        const auto start = std::chrono::steady_clock::now();
        const auto result = client.Send({"probe.read", nlohmann::json::object()}, "local-test-token");
        if (!result.success) { std::cerr << result.errorMessage; return 1; }
        timings.push_back(std::chrono::duration<double, std::milli>(
            std::chrono::steady_clock::now() - start).count());
    }
    std::cout << timings.dump() << '\n';
}
