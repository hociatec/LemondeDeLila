#pragma once
#include <algorithm>
#include <string>

namespace lila::modules::gameplay::application::grid
{
inline std::string GridCoordinate(int x, int y)
{
    if (x < 0 || y < 0) return {};
    std::string column;
    for (long long value = static_cast<long long>(x) + 1; value > 0; value /= 26)
    {
        --value;
        column.push_back(static_cast<char>('A' + value % 26));
    }
    std::reverse(column.begin(), column.end());
    return column + std::to_string(static_cast<long long>(y) + 1);
}
}
