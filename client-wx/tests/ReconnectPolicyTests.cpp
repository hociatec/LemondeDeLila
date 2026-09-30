#include <cassert>
#include <chrono>
#include <stop_token>
#include <thread>

#include "shared/network/application/realtime/ReconnectPolicy.h"

int main()
{
    using namespace std::chrono_literals;
    using lila::shared::network::realtime::ReconnectPolicy;
    using lila::shared::network::realtime::ReconnectPolicyOptions;
    using lila::shared::network::realtime::WaitForCancellation;

    ReconnectPolicy policy(ReconnectPolicyOptions{100ms, 500ms, 0.2}, 42);
    for (int attempt = 0; attempt < 20; ++attempt)
    {
        const auto delay = policy.NextDelay();
        assert(delay >= 1ms);
        assert(delay <= 500ms);
    }
    policy.Reset();
    assert(policy.NextDelay() <= 120ms);

    std::stop_source stop;
    const auto startedAt = std::chrono::steady_clock::now();
    std::jthread canceller([&stop]
    {
        std::this_thread::sleep_for(10ms);
        stop.request_stop();
    });
    assert(WaitForCancellation(stop.get_token(), 5s));
    assert(std::chrono::steady_clock::now() - startedAt < 500ms);
}
