#include "modules/rooms/presentation/shell/RoomPanel.h"

#include <wx/event.h>
#include <wx/textctrl.h>
#include <wx/window.h>

#include "modules/rooms/presentation/shortcuts/RoomShortcutPolicy.h"

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
    if (TryHandleShortcut(event))
    {
        event.Skip(false);
        return;
    }
    event.Skip();
}

bool RoomPanel::TryHandleShortcut(wxKeyEvent& event)
{
    const int key = NormalizeShortcutKey(event);
    if (state_ != State::Ready) return false;

    const auto* focusedText = dynamic_cast<wxTextCtrl*>(wxWindow::FindFocus());
    if (focusedText != nullptr && focusedText->IsEditable() && !event.ControlDown())
        return false;

    const auto action = RoomShortcutPolicy::Resolve(
        key,
        event.ControlDown(),
        event.AltDown(),
        event.MetaDown(),
        event.ShiftDown(),
        room_);
    if (action.empty()) return false;

    HandleAction(action);
    return true;
}
}
