#pragma once

#include <algorithm>
#include <cctype>
#include <string>

namespace lila::shared::text
{
[[nodiscard]] inline std::string TrimCopy(std::string value)
{
    const auto begin = std::find_if_not(value.begin(), value.end(), [](unsigned char c) {
        return std::isspace(c) != 0;
    });

    const auto end = std::find_if_not(value.rbegin(), value.rend(), [](unsigned char c) {
        return std::isspace(c) != 0;
    }).base();

    if (begin >= end)
    {
        return {};
    }

    value.erase(end, value.end());
    value.erase(value.begin(), begin);
    return value;
}
}
