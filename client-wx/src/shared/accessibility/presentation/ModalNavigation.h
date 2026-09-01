#pragma once

#include <algorithm>
#include <cstddef>
#include <iterator>
#include <utility>
#include <vector>

#include <wx/event.h>
#include <wx/window.h>

#include "shared/accessibility/application/NavigationController.h"

namespace lila::shared::accessibility
{
inline void CycleModalFocus(const std::vector<wxWindow*>& controls, bool backwards)
{
    std::vector<wxWindow*> focusable;
    focusable.reserve(controls.size());
    for (auto* control : controls)
        if (NavigationController::IsFocusable(control)) focusable.push_back(control);
    if (focusable.empty()) return;

    auto* focused = wxWindow::FindFocus();
    const auto current = std::find_if(
        focusable.begin(), focusable.end(),
        [focused](wxWindow* control)
        {
            return focused == control ||
                NavigationController::IsDescendantOf(focused, control);
        });
    std::size_t index = current == focusable.end()
        ? (backwards ? focusable.size() - 1 : 0)
        : static_cast<std::size_t>(std::distance(focusable.begin(), current));
    if (current != focusable.end())
        index = backwards ? (index == 0 ? focusable.size() - 1 : index - 1)
                          : (index + 1) % focusable.size();
    NavigationController::Focus(focusable[index]);
}

template <typename CancelAction, typename SubmitAction>
bool HandleModalKey(
    wxKeyEvent& event,
    bool active,
    const std::vector<wxWindow*>& controls,
    CancelAction&& cancel,
    SubmitAction&& submit)
{
    if (!active) return false;
    const int key = event.GetKeyCode();
    if (key == WXK_TAB || key == WXK_NUMPAD_TAB)
    {
        CycleModalFocus(controls, event.ShiftDown());
        return true;
    }
    if (key == WXK_ESCAPE)
    {
        std::forward<CancelAction>(cancel)();
        return true;
    }
    if (key == WXK_RETURN || key == WXK_NUMPAD_ENTER)
    {
        std::forward<SubmitAction>(submit)();
        return true;
    }
    return false;
}
}
