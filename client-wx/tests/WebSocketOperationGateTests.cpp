#include <atomic>
#include <cassert>
#include <chrono>
#include <thread>

#include "shared/network/application/websocket/WebSocketOperationGate.h"

int main()
{
    using namespace std::chrono_literals;
    using lila::shared::network::websocket::WebSocketOperationGate;
    using lila::shared::network::websocket::WebSocketOperationPhase;

    WebSocketOperationGate gate;
    auto receive = gate.Begin(WebSocketOperationPhase::Receive);
    auto send = gate.Begin(WebSocketOperationPhase::Send);
    auto handshake = gate.Begin(WebSocketOperationPhase::Handshake);
    assert(!gate.WaitForIdle(1ms));

    const auto generation = receive.generation;
    assert(gate.CancelIfCurrent(generation));
    assert(!gate.CancelIfCurrent(generation));
    assert(gate.Generation() == generation + 1);

    std::atomic_bool closeReturned{false};
    std::jthread close([&]
    {
        closeReturned = gate.WaitForIdle(250ms);
    });
    std::this_thread::sleep_for(5ms);
    assert(!closeReturned.load());
    gate.End(send);
    gate.End(handshake);
    assert(gate.WaitForIdle(10ms, false));
    assert(!closeReturned.load());
    gate.End(receive);
    close.join();
    assert(closeReturned.load());

    auto unresponsiveReceive = gate.Begin(WebSocketOperationPhase::Receive);
    const auto boundedStart = std::chrono::steady_clock::now();
    assert(!gate.WaitForIdle(5ms));
    assert(std::chrono::steady_clock::now() - boundedStart < 100ms);
    gate.End(unresponsiveReceive);

    // Repeated Close/Cancel calls are idempotent with respect to active work:
    // they only advance the generation and never corrupt operation counts.
    constexpr int Threads = 8;
    std::jthread cancellers[Threads];
    for (auto& worker : cancellers)
        worker = std::jthread([&]
        {
            for (int i = 0; i < 1'000; ++i) static_cast<void>(gate.Cancel());
        });
    for (auto& worker : cancellers) worker.join();
    assert(gate.WaitForIdle(10ms));
}
