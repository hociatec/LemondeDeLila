#include "shared/network/application/realtime/ReconnectPolicy.h"

#include <algorithm>
#include <condition_variable>
#include <limits>
#include <mutex>
#include <random>

namespace lila::shared::network::realtime
{
namespace
{
std::uint64_t InitialSeed(std::uint64_t requested) noexcept
{
    if (requested != 0) return requested;
    try
    {
        const auto seed = std::random_device{}();
        return seed == 0 ? 0x9e3779b97f4a7c15ULL : seed;
    }
    catch (...)
    {
        return 0x9e3779b97f4a7c15ULL;
    }
}

std::uint64_t NextRandom(std::uint64_t& state) noexcept
{
    state ^= state >> 12;
    state ^= state << 25;
    state ^= state >> 27;
    return state * 0x2545f4914f6cdd1dULL;
}
}

ReconnectPolicy::ReconnectPolicy(
    ReconnectPolicyOptions options,
    std::uint64_t jitterSeed) noexcept
    : options_(options), jitterState_(InitialSeed(jitterSeed))
{
    if (options_.initialDelay.count() < 1)
        options_.initialDelay = std::chrono::milliseconds(1);
    if (options_.maximumDelay < options_.initialDelay)
        options_.maximumDelay = options_.initialDelay;
    options_.jitterRatio = std::clamp(options_.jitterRatio, 0.0, 0.5);
}

std::chrono::milliseconds ReconnectPolicy::NextDelay() noexcept
{
    auto delay = options_.initialDelay;
    for (unsigned int index = 0; index < attempt_; ++index)
    {
        if (delay >= options_.maximumDelay / 2)
        {
            delay = options_.maximumDelay;
            break;
        }
        delay *= 2;
    }
    if (attempt_ < std::numeric_limits<unsigned int>::max()) ++attempt_;

    const auto unit = static_cast<double>(NextRandom(jitterState_) >> 11) /
        static_cast<double>(std::uint64_t{1} << 53);
    const auto factor = 1.0 + ((unit * 2.0) - 1.0) * options_.jitterRatio;
    const auto jittered = std::chrono::milliseconds(
        static_cast<std::chrono::milliseconds::rep>(delay.count() * factor));
    return std::clamp(
        jittered,
        std::chrono::milliseconds(1),
        options_.maximumDelay);
}

void ReconnectPolicy::Reset() noexcept
{
    attempt_ = 0;
}

bool WaitForCancellation(
    std::stop_token stopToken,
    std::chrono::milliseconds delay)
{
    if (stopToken.stop_requested()) return true;
    std::mutex mutex;
    std::condition_variable_any wake;
    std::unique_lock lock(mutex);
    wake.wait_for(lock, stopToken, delay, [] { return false; });
    return stopToken.stop_requested();
}
}
