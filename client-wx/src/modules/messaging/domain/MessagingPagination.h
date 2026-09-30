#pragma once

#include <algorithm>

namespace lila::modules::messaging::domain
{
inline constexpr int MaximumPageLimit = 200;

[[nodiscard]] inline int NormalizePageLimit(int limit) noexcept
{
    return std::clamp(limit, 1, MaximumPageLimit);
}
}
