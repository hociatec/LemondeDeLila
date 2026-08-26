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
    if (controls.empty()) return;
    const auto current = std::find(controls.begin(), controls.end(), wxWindow::FindFocus());
    std::size_t index = current == controls.end()
        ? (backwards ? controls.size() - 1 : 0)
        : static_cast<std::size_t>(std::distance(controls.begin(), current));
    if (current != controls.end())
        index = backwards ? (index == 0 ? controls.size() - 1 : index - 1)
                          : (index + 1) % controls.size();
    NavigationController::Focus(controls[index]);
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
