#include <winsock2.h>
#include <ws2tcpip.h>
#include <chrono>
#include <future>
#include <iostream>
#include <stop_token>
#include <stdexcept>
#include <thread>
#include "shared/network/infrastructure/http/WsTicketTransport.h"

int main()
{
    WSADATA data{};
    if (WSAStartup(MAKEWORD(2, 2), &data) != 0) return 1;
    const SOCKET listener = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    sockaddr_in address{};
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (bind(listener, reinterpret_cast<sockaddr*>(&address), sizeof(address)) != 0 ||
        listen(listener, 1) != 0) return 1;
    int size = sizeof(address);
    getsockname(listener, reinterpret_cast<sockaddr*>(&address), &size);
    std::promise<void> received;
    auto requestReceived = received.get_future();
    std::promise<void> release;
    auto released = release.get_future();
    std::jthread server([&]
    {
        const SOCKET peer = accept(listener, nullptr, nullptr);
        if (peer == INVALID_SOCKET) { received.set_value(); return; }
        char buffer[4096];
        static_cast<void>(recv(peer, buffer, sizeof(buffer), 0));
        received.set_value();
        released.wait(); // Deliberately withhold the response.
        shutdown(peer, SD_BOTH);
        closesocket(peer);
    });
    std::stop_source stop;
    auto request = std::async(std::launch::async, [&]
    {
        try
        {
            static_cast<void>(lila::shared::network::http::RequestWsTicketResponse(
                "http://127.0.0.1:" + std::to_string(ntohs(address.sin_port)) + "/slow",
                {}, 1024, stop.get_token()));
        }
        catch (const std::exception&) { return true; }
        return false;
    });
    const bool connected = requestReceived.wait_for(std::chrono::seconds(5)) == std::future_status::ready;
    stop.request_stop();
    const bool cancelled = request.wait_for(std::chrono::seconds(2)) == std::future_status::ready;
    release.set_value();
    closesocket(listener);
    server.join();
    const bool rejected = request.get();
    WSACleanup();
    if (!connected || !cancelled || !rejected)
    {
        std::cerr << "Cancellation did not interrupt a stalled HTTP response.\n";
        return 1;
    }
    std::cout << "Stalled HTTP request cancelled.\n";
}
