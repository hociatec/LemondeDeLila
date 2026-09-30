#pragma once

#include <chrono>
#include <cstdint>
#include <stop_token>

namespace lila::shared::network::realtime
{
struct ReconnectPolicyOptions final
{
    std::chrono::milliseconds initialDelay{1'000};
    std::chrono::milliseconds maximumDelay{30'000};
    double jitterRatio = 0.2;
};

class ReconnectPolicy final
{
public:
    explicit ReconnectPolicy(
        ReconnectPolicyOptions options = {},
        std::uint64_t jitterSeed = 0) noexcept;

    [[nodiscard]] std::chrono::milliseconds NextDelay() noexcept;
    void Reset() noexcept;

private:
    ReconnectPolicyOptions options_;
    std::uint64_t jitterState_;
    unsigned int attempt_ = 0;
};

[[nodiscard]] bool WaitForCancellation(
    std::stop_token stopToken,
    std::chrono::milliseconds delay);
}
