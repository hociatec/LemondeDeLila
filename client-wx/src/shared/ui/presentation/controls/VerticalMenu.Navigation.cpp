#include "shared/ui/presentation/controls/VerticalMenu.h"

#include <wx/listbox.h>
#include <wx/wxcrt.h>

#include "shared/ui/presentation/controls/VerticalMenuEntry.h"

namespace lila::shared::ui::controls
{
bool VerticalMenu::FocusBoundaryFromKey(wxKeyEvent& event)
{
    if ((!event.ControlDown() && !event.CmdDown()) || itemCount_ == 0) return false;
    const int key = event.GetKeyCode();
    if (key == WXK_HOME || key == WXK_NUMPAD_HOME)
    {
        FocusIndex(0);
        return true;
    }
    if (key == WXK_END || key == WXK_NUMPAD_END)
    {
        FocusIndex(itemCount_ - 1);
        return true;
    }
    return false;
}

bool VerticalMenu::FocusByInitialFromKey(wxKeyEvent& event, std::size_t currentIndex)
{
    if (event.ControlDown() || event.AltDown() || event.MetaDown() || itemCount_ == 0)
        return false;

    const int unicode = event.GetUnicodeKey();
    if (unicode == WXK_NONE || unicode < 0) return false;
    const wxUniChar initial(static_cast<wchar_t>(unicode));
    if (!wxIsalnum(initial)) return false;
    if (const auto next = FindNextItemByInitial(initial, currentIndex)) FocusIndex(*next);
    // As with a native list, a typed initial is navigation, never activation.
    return true;
}

std::optional<std::size_t> VerticalMenu::FindNextItemByInitial(
    wxUniChar initial,
    std::size_t currentIndex) const
{
    const wxUniChar normalizedInitial = wxTolower(initial);
    for (std::size_t offset = 1; offset <= itemCount_; ++offset)
    {
        const std::size_t index = (currentIndex + offset) % itemCount_;
        const wxString label = listBox_ != nullptr && index < listBox_->GetCount()
            ? listBox_->GetString(static_cast<unsigned int>(index)) : wxString{};
        std::size_t first = 0;
        while (first < label.length() && wxIsspace(label[first])) ++first;
        if (first < label.length() && wxTolower(label[first]) == normalizedInitial)
            return index;
    }
    return std::nullopt;
}
}
