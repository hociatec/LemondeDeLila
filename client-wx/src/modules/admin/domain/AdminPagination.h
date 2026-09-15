#pragma once

#include <algorithm>
#include <array>
#include <string_view>
#include <vector>

namespace lila::modules::admin::domain
{
enum class AdminPaginationMode
{
    None,
    PageNumber,
    Offset,
    DisplayLimit,
};

struct AdminPaginationSpec final
{
    AdminPaginationMode mode = AdminPaginationMode::None;
    int defaultPageSize = 0;
    int maximumPageSize = 0;
};

[[nodiscard]] inline AdminPaginationSpec GetAdminPaginationSpec(std::string_view commandId)
{
    if (commandId == "users.list")
        return {AdminPaginationMode::PageNumber, 20, 100};
    if (commandId == "bugs.list" || commandId == "bugs.comments" ||
        commandId == "mnemo.questions")
        return {AdminPaginationMode::Offset, 50, 100};
    if (commandId == "rooms.list" || commandId == "rooms.joinable" ||
        commandId == "dashboard.rooms")
        return {AdminPaginationMode::DisplayLimit, commandId == "dashboard.rooms" ? 20 : 200, 1000};
    if (commandId == "chat.messages")
        return {AdminPaginationMode::DisplayLimit, 200, 500};
    if (commandId == "contacts.threads")
        return {AdminPaginationMode::DisplayLimit, 200, 200};
    return {};
}

[[nodiscard]] inline bool IsAdminPaginationField(
    std::string_view commandId,
    std::string_view fieldName)
{
    const auto spec = GetAdminPaginationSpec(commandId);
    if (spec.mode == AdminPaginationMode::None) return false;
    if (fieldName == "limit") return true;
    if (spec.mode == AdminPaginationMode::PageNumber) return fieldName == "page";
    if (spec.mode == AdminPaginationMode::Offset) return fieldName == "offset";
    return false;
}

[[nodiscard]] inline std::vector<int> AdminPageSizeChoices(
    const AdminPaginationSpec& spec,
    int currentPageSize)
{
    constexpr std::array<int, 7> Presets{10, 20, 50, 100, 200, 500, 1000};
    std::vector<int> result;
    for (const auto value : Presets)
        if (value <= spec.maximumPageSize) result.push_back(value);
    if (currentPageSize > 0 && currentPageSize <= spec.maximumPageSize &&
        std::find(result.begin(), result.end(), currentPageSize) == result.end())
    {
        result.push_back(currentPageSize);
        std::ranges::sort(result);
    }
    return result;
}
}
