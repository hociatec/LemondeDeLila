#pragma once

#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include <nlohmann/json_fwd.hpp>

namespace lila::modules::admin::domain
{
enum class AdminFieldKind
{
    Automatic,
    Multiline,
    StringList,
    Choice,
};

struct AdminFieldMetadata final
{
    std::wstring label;
    std::wstring help;
    AdminFieldKind kind = AdminFieldKind::Automatic;
    bool optional = false;
    bool includedByDefault = true;
    std::vector<std::string> choices;
    std::vector<std::wstring> choiceLabels;
};

struct AdminFormValidationError final
{
    std::string field;
    std::wstring message;
};

[[nodiscard]] AdminFieldMetadata GetAdminFieldMetadata(
    std::string_view commandId,
    std::string_view fieldName);
[[nodiscard]] std::optional<AdminFormValidationError> ValidateAdminFormPayload(
    std::string_view commandId,
    const nlohmann::json& payload);
}
