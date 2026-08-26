#pragma once

#include <cstddef>
#include <utility>
#include <vector>

#include <wx/stattext.h>
#include <wx/window.h>

#include "shared/accessibility/application/FocusCoordinator.h"
#include "shared/accessibility/application/NavigationController.h"
#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"
#include "shared/ui/presentation/theme/Theme.h"

namespace lila::shared::ui::layout
{
inline void UpdateListPageStatus(
    wxWindow& owner,
    wxStaticText& status,
    const wxString& message,
    bool isError)
{
    status.SetLabel(message);
    status.SetForegroundColour(isError ? Theme::Error() : Theme::Accent());
    status.Show(!message.empty());
    if (isError && !message.empty())
        lila::shared::accessibility::AccessibilityUtils::AnnounceStatus(status, message);
    else
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleStatus(status, message);
    owner.Layout();
}

inline void FocusListPageIfVisible(
    wxWindow& owner,
    const lila::shared::accessibility::FocusManager::Plan& focusPlan)
{
    if (owner.IsShownOnScreen())
        static_cast<void>(lila::shared::accessibility::FocusCoordinator::Apply(focusPlan));
}

template <typename SelectionChanged, typename Activated, typename Escaped>
void BindListPageMenu(
    wxWindow& owner,
    lila::shared::ui::controls::VerticalMenu& menu,
    SelectionChanged&& selectionChanged,
    Activated&& activated,
    Escaped&& escaped)
{
    menu.SetSelectionChangedHandler(std::forward<SelectionChanged>(selectionChanged));
    menu.SetActivatedHandler(std::forward<Activated>(activated));
    lila::shared::accessibility::NavigationController::BindEscapeNavigation(
        owner,
        [handler = std::forward<Escaped>(escaped)]() mutable
        {
            handler();
            return true;
        });
}

template <typename Navigator, typename SelectionEnabled, typename Activated, typename Escaped>
void BindNavigatedListPageMenu(
    wxWindow& owner,
    lila::shared::ui::controls::VerticalMenu& menu,
    Navigator& navigator,
    SelectionEnabled&& selectionEnabled,
    Activated&& activated,
    Escaped&& escaped)
{
    BindListPageMenu(
        owner,
        menu,
        [&navigator, enabled = std::forward<SelectionEnabled>(selectionEnabled)](
            std::size_t index) mutable
        {
            if (enabled()) navigator.Select(index);
        },
        std::forward<Activated>(activated),
        std::forward<Escaped>(escaped));
}

template <typename Range, typename IdSelector, typename LabelSelector>
std::vector<lila::shared::ui::controls::VerticalMenuItem> BuildNamedMenuItems(
    const Range& values,
    IdSelector&& idSelector,
    LabelSelector&& labelSelector,
    wxString emptyLabel)
{
    std::vector<lila::shared::ui::controls::VerticalMenuItem> items;
    items.reserve(values.size());
    for (const auto& value : values)
        items.push_back({idSelector(value), labelSelector(value)});
    if (items.empty()) items.push_back({"empty", std::move(emptyLabel)});
    return items;
}
}
