#pragma once

#include <string_view>

#include <nlohmann/json.hpp>

namespace lila::modules::admin::presentation
{
[[nodiscard]] constexpr bool ShouldCopyContextValue(
    std::string_view commandId,
    std::string_view fieldName) noexcept
{
    // A report and a new comment both expose a field named "content", but
    // their values are unrelated. A comment must always start empty.
    return commandId != "bugs.comment" || fieldName != "content";
}

[[nodiscard]] inline std::string AdminGameType(const nlohmann::json& item)
{
    if (!item.is_object()) return {};
    for (const auto key : {"gameType", "id"})
    {
        const auto value = item.find(key);
        if (value != item.end() && value->is_string()) return value->get<std::string>();
    }
    return {};
}

[[nodiscard]] inline bool IsMnemoQuizGame(const nlohmann::json& item)
{
    return AdminGameType(item) == "arche-de-mnemosyne";
}
}
