#pragma once

#include <cstdint>

namespace lila::modules::session::domain
{
inline constexpr std::int64_t ResumeOnceLifetimeSeconds = 120;

[[nodiscard]] constexpr bool IsResumeOnceWindowValid(
    std::int64_t resumeUntil,
    std::int64_t now) noexcept
{
    return now >= 0 && resumeUntil > 0 && resumeUntil >= now &&
        static_cast<std::uint64_t>(resumeUntil) - static_cast<std::uint64_t>(now) <=
            static_cast<std::uint64_t>(ResumeOnceLifetimeSeconds);
}
}
