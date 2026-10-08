#pragma once

#include <array>
#include <nlohmann/json.hpp>
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::admin::presentation
{
inline std::vector<lila::shared::ui::controls::VerticalMenuItem> BuildBugReportStatusItems(
    const nlohmann::json& counts, const wxString& unavailableSuffix)
{
    constexpr std::array<std::pair<const char*, const wchar_t*>, 5> statuses{{
        {"pending", L"En attente"}, {"in_progress", L"En cours"},
        {"to_test", L"À tester"}, {"done", L"Terminés"}, {"refused", L"Refusés"},
    }};
    std::vector<lila::shared::ui::controls::VerticalMenuItem> items{{"new", L"Nouveau rapport"}};
    for (std::size_t index = 0; index < statuses.size(); ++index)
    {
        const auto count = counts.find(statuses[index].first);
        const auto suffix = count != counts.end() && count->is_number_integer()
            ? wxString::Format(L" (%lld)", count->get<long long>()) : unavailableSuffix;
        items.push_back({std::to_string(index), wxString(statuses[index].second) + suffix});
    }
    return items;
}
}
