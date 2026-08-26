#include "shared/accessibility/presentation/ActionButton.h"

#include <wx/event.h>

namespace lila::shared::accessibility
{
bool ActionButton::ShouldActivateOnKeyCode(int keyCode) noexcept
{
    switch (keyCode)
    {
    case WXK_RETURN:
    case WXK_NUMPAD_ENTER:
    case WXK_SPACE:
    case WXK_NUMPAD_SPACE:
        return true;
    default:
        return false;
    }
}

bool ActionButton::ShouldPreserveVerticalNavigation(int keyCode) noexcept
{
    switch (keyCode)
    {
    case WXK_UP:
    case WXK_DOWN:
    case WXK_NUMPAD_UP:
    case WXK_NUMPAD_DOWN:
        return true;
    default:
        return false;
    }
}

ActionButton::ActionButton(
    wxWindow* parent,
    wxWindowID id,
    const wxString& label,
    const wxPoint& pos,
    const wxSize& size,
    long style)
    : wxButton(parent, id, label, pos, size, style)
{
    Bind(wxEVT_CHAR_HOOK, &ActionButton::OnCharHook, this);
}

void ActionButton::OnCharHook(wxKeyEvent& event)
{
    const int keyCode = event.GetKeyCode();
    if (ShouldActivateOnKeyCode(keyCode))
    {
        // Keep standard button activation behavior accessible for keyboard users.
        wxCommandEvent clickEvent(wxEVT_BUTTON, GetId());
        clickEvent.SetEventObject(this);
        ProcessWindowEvent(clickEvent);
        return;
    }

    if (ShouldPreserveVerticalNavigation(keyCode))
    {
        event.Skip();
        return;
    }

    event.Skip();
}
}
