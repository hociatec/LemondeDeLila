#pragma once

#include <string>
#include <string_view>
#include <utility>
#include <span>
#include <vector>

#include <wx/string.h>

#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::shared::ui::navigation
{
struct MenuBlueprintItem
{
    std::string id;
    wxString label;
    wxString statusMessage;
};

[[nodiscard]] inline std::vector<lila::shared::ui::controls::VerticalMenuItem> BuildMenuItems(
    std::span<const MenuBlueprintItem> items)
{
    std::vector<lila::shared::ui::controls::VerticalMenuItem> menuItems;
    menuItems.reserve(items.size());
    for (std::size_t index = 0; index < items.size(); ++index)
    {
        const auto& item = items[index];
        const std::string itemId = item.id.empty() ? std::to_string(index) : item.id;
        menuItems.push_back({itemId, item.label});
    }

    return menuItems;
}

template<typename SelectionChangedHandler, typename ActivatedHandler>
inline void BindMenuHandlers(
    lila::shared::ui::controls::VerticalMenu& menu,
    SelectionChangedHandler&& onSelectionChanged,
    ActivatedHandler&& onActivated)
{
    menu.SetSelectionChangedHandler(std::forward<SelectionChangedHandler>(onSelectionChanged));
    menu.SetActivatedHandler(std::forward<ActivatedHandler>(onActivated));
}

[[nodiscard]] inline wxString GetMenuStatus(std::span<const MenuBlueprintItem> items, std::size_t index)
{
    if (index >= items.size())
    {
        return wxEmptyString;
    }

    return items[index].statusMessage;
}
}
