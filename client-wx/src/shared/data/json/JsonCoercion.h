#pragma once

#include <optional>
#include <string>

#include <nlohmann/json.hpp>

namespace lila::shared::data::json
{
[[nodiscard]] inline std::string ScalarText(const nlohmann::json& value)
{
    if (value.is_string()) return value.get<std::string>();
    if (value.is_number_integer()) return std::to_string(value.get<long long>());
    if (value.is_number_unsigned()) return std::to_string(value.get<unsigned long long>());
    if (value.is_number_float()) return std::to_string(value.get<double>());
    return {};
}

[[nodiscard]] inline std::optional<int> ReadOptionalIntegerCoerced(
    const nlohmann::json& object,
    const char* field)
{
    const auto found = object.find(field);
    if (found == object.end()) return std::nullopt;
    if (found->is_number_integer()) return found->get<int>();
    if (!found->is_string()) return std::nullopt;

    try
    {
        std::size_t consumed = 0;
        const auto raw = found->get<std::string>();
        const int parsed = std::stoi(raw, &consumed);
        return consumed == raw.size() ? std::optional<int>{parsed} : std::nullopt;
    }
    catch (...)
    {
        return std::nullopt;
    }
}
}
