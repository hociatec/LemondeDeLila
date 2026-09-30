#pragma once

#include <algorithm>
#include <chrono>
#include <utility>

namespace lila::modules::update
{
inline constexpr auto MaximumUpdateRetryDelay = std::chrono::milliseconds(5000);
inline constexpr auto UpdateCancellationPollInterval = std::chrono::milliseconds(50);

template <typename Cancelled, typename Wait>
[[nodiscard]] bool WaitForUpdateRetry(
    std::chrono::milliseconds requestedDelay,
    Cancelled&& cancelled,
    Wait&& wait)
{
    auto remaining = std::clamp(
        requestedDelay,
        std::chrono::milliseconds::zero(),
        MaximumUpdateRetryDelay);
    while (remaining > std::chrono::milliseconds::zero())
    {
        if (std::forward<Cancelled>(cancelled)()) return false;
        const auto slice = std::min(remaining, UpdateCancellationPollInterval);
        std::forward<Wait>(wait)(slice);
        remaining -= slice;
    }
    return !std::forward<Cancelled>(cancelled)();
}
}
