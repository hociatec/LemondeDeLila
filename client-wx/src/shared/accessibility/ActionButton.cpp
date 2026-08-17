#include "shared/accessibility/ActionButton.h"

#include <wx/event.h>

namespace lila::shared::accessibility
{
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
    switch (event.GetKeyCode())
    {
    case WXK_RETURN:
    case WXK_NUMPAD_ENTER:
    case WXK_SPACE:
    case WXK_NUMPAD_SPACE:
        // Keep standard button activation behavior accessible for keyboard users.
    {
        wxCommandEvent clickEvent(wxEVT_BUTTON, GetId());
        clickEvent.SetEventObject(this);
        ProcessWindowEvent(clickEvent);
        return;
    }
    case WXK_LEFT:
    case WXK_RIGHT:
    case WXK_UP:
    case WXK_DOWN:
    case WXK_NUMPAD_LEFT:
    case WXK_NUMPAD_RIGHT:
    case WXK_NUMPAD_UP:
    case WXK_NUMPAD_DOWN:
        event.Skip();
        return;
    default:
        event.Skip();
        return;
    }
}
}
