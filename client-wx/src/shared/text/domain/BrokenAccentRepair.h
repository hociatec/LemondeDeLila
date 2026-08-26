#pragma once

#include <atomic>

namespace lila::shared::text
{
inline std::atomic_bool& BrokenAccentRepairState() noexcept
{
    static std::atomic_bool enabled{true};
    return enabled;
}

inline void SetBrokenAccentRepairEnabled(bool enabled) noexcept
{
    BrokenAccentRepairState().store(enabled, std::memory_order_relaxed);
}

[[nodiscard]] inline bool IsBrokenAccentRepairEnabled() noexcept
{
    return BrokenAccentRepairState().load(std::memory_order_relaxed);
}
}
