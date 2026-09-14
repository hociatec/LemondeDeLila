#pragma once

#include <string>
#include <string_view>
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
};

[[nodiscard]] AdminFieldMetadata GetAdminFieldMetadata(
    std::string_view commandId,
    std::string_view fieldName);
}
