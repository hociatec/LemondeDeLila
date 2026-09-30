#pragma once

#include <charconv>
#include <optional>
#include <string_view>

namespace lila::shared::data
{
[[nodiscard]] inline std::optional<int> ParseInteger(std::string_view text) noexcept
{
    if (text.empty()) return std::nullopt;
    int value = 0;
    const auto [end, error] = std::from_chars(
        text.data(), text.data() + text.size(), value);
    if (error != std::errc{} || end != text.data() + text.size())
        return std::nullopt;
    return value;
}
}
