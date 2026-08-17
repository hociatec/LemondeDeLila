#pragma once

#include <ctime>
#include <optional>
#include <iomanip>
#include <sstream>
#include <string>

namespace lila::shared::data::datetime
{
inline std::optional<std::time_t> ParseIsoTimestamp(const std::string& rawValue)
{
    if (rawValue.empty())
    {
        return std::nullopt;
    }

    std::string normalized = rawValue;
    if (!normalized.empty() && normalized.back() == 'Z')
    {
        normalized.pop_back();
    }

    const std::size_t fractionSeparator = normalized.find('.');
    if (fractionSeparator != std::string::npos)
    {
        normalized = normalized.substr(0, fractionSeparator);
    }

    std::tm parsed{};
    std::istringstream input(normalized);
    input >> std::get_time(&parsed, "%Y-%m-%dT%H:%M:%S");
    if (input.fail())
    {
        return std::nullopt;
    }

#ifdef _WIN32
    return _mkgmtime(&parsed);
#else
    return timegm(&parsed);
#endif
}
}
