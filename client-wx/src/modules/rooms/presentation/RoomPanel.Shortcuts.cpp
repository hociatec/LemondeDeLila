#include "modules/rooms/presentation/RoomPanel.h"

#include <wx/event.h>
#include <wx/textctrl.h>
#include <wx/window.h>

#include "modules/rooms/presentation/RoomShortcutPolicy.h"

namespace lila::modules::rooms::presentation
{
namespace
{
int NormalizeShortcutKey(const wxKeyEvent& event)
{
    int key = event.GetKeyCode();
    if (event.ControlDown() && key >= 1 && key <= 26)
        key = 'A' + key - 1;
    if (key >= 'a' && key <= 'z')
        key = 'A' + key - 'a';
    return key;
}
}

void RoomPanel::HandleShortcut(wxKeyEvent& event)
{
    const int key = NormalizeShortcutKey(event);
    if (state_ != State::Ready)
    {
        event.Skip();
        return;
    }

    const auto* focusedText = dynamic_cast<wxTextCtrl*>(wxWindow::FindFocus());
    if (focusedText != nullptr && focusedText->IsEditable() && !event.ControlDown())
    {
        event.Skip();
        return;
    }

    const auto action = RoomShortcutPolicy::Resolve(
        key,
        event.ControlDown(),
        event.AltDown(),
        event.MetaDown(),
        event.ShiftDown(),
        room_);
    if (action.empty())
    {
        event.Skip();
        return;
    }

    HandleAction(action);
    event.Skip(false);
}
}
