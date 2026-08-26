#pragma once

#include <wx/listbox.h>
#include <wx/window.h>

namespace lila::shared::ui::controls::list_box
{
[[nodiscard]] inline bool MoveSelection(wxListBox& list, bool backwards)
{
    const auto count = list.GetCount();
    if (count == 0) return false;

    int selected = list.GetSelection();
    if (selected == wxNOT_FOUND)
        selected = backwards ? static_cast<int>(count) - 1 : 0;
    else if (backwards && selected > 0)
        --selected;
    else if (!backwards && static_cast<unsigned int>(selected + 1) < count)
        ++selected;

    list.SetSelection(selected);
    return true;
}

[[nodiscard]] inline wxString SelectedLabel(const wxListBox& list)
{
    const int selected = list.GetSelection();
    return selected == wxNOT_FOUND ? wxString{} : list.GetString(selected);
}

[[nodiscard]] inline wxWindow* NavigationTarget(const wxWindow& owner, wxListBox& list) noexcept
{
    return owner.IsShown() && list.GetCount() > 0 ? &list : nullptr;
}
}
