#pragma once

#include <wx/button.h>

namespace lila::shared::accessibility
{
class ActionButton : public wxButton
{
public:
    ActionButton(
        wxWindow* parent,
        wxWindowID id,
        const wxString& label,
        const wxPoint& pos = wxDefaultPosition,
        const wxSize& size = wxDefaultSize,
        long style = 0);

    [[nodiscard]] static bool ShouldActivateOnKeyCode(int keyCode) noexcept;
    [[nodiscard]] static bool ShouldPreserveVerticalNavigation(int keyCode) noexcept;
    [[nodiscard]] static bool ShouldSuppressHorizontalNavigation(int keyCode) noexcept;
    [[nodiscard]] static bool ShouldSuppressTabNavigation(int keyCode) noexcept;
    void SetMenuNavigationMode(bool enabled) noexcept;

private:
    void OnCharHook(wxKeyEvent& event);

    bool menuNavigationMode_ = false;
};
}
