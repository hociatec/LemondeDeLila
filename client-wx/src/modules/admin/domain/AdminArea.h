#pragma once

#include <string_view>
#include <vector>

namespace lila::modules::admin::domain
{
enum class AdminItemKind
{
    None,
    User,
    ChatMessage,
    Contact,
    BugReport,
    Room,
    Game,
    Category,
    Bot,
    MnemoCategory,
    MnemoQuestion,
    Role,
    Sound,
    Ambience,
};

struct AdminArea final
{
    std::string_view id;
    std::wstring_view group;
    std::wstring_view label;
    std::wstring_view description;
    std::vector<std::string_view> commandIds;
    std::string_view automaticCommandId;
    AdminItemKind itemKind = AdminItemKind::None;
};

[[nodiscard]] const std::vector<AdminArea>& GetAdminAreas();
}
