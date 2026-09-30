#pragma once

#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

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

enum class AdminFormValueKind
{
    Other,
    Text,
    Integer,
    Number,
    TextList,
    InvalidList,
};

struct AdminFormValue final
{
    [[nodiscard]] static AdminFormValue Text(std::string field, std::string value)
    {
        AdminFormValue result;
        result.field = std::move(field);
        result.kind = AdminFormValueKind::Text;
        result.text = std::move(value);
        return result;
    }
    [[nodiscard]] static AdminFormValue Integer(std::string field, double value)
    {
        AdminFormValue result;
        result.field = std::move(field);
        result.kind = AdminFormValueKind::Integer;
        result.number = value;
        return result;
    }
    [[nodiscard]] static AdminFormValue TextList(
        std::string field, std::vector<std::string> values)
    {
        AdminFormValue result;
        result.field = std::move(field);
        result.kind = AdminFormValueKind::TextList;
        result.textList = std::move(values);
        return result;
    }

    std::string field;
    AdminFormValueKind kind = AdminFormValueKind::Other;
    std::string text;
    double number = 0.0;
    std::vector<std::string> textList;
};

[[nodiscard]] AdminFieldMetadata GetAdminFieldMetadata(
    std::string_view commandId,
    std::string_view fieldName);
[[nodiscard]] std::optional<AdminFormValidationError> ValidateAdminFormPayload(
    std::string_view commandId,
    const std::vector<AdminFormValue>& payload);
}
