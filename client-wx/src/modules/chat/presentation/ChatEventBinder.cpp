#include "modules/chat/presentation/ChatEventBinder.h"

#include <utility>

#include <wx/button.h>
#include <wx/event.h>
#include <wx/frame.h>
#include <wx/listbox.h>
#include <wx/textctrl.h>

namespace lila::modules::chat::presentation
{
namespace
{
void InvokeChatHandler(const std::function<void()>& handler)
{
    if (handler)
    {
        handler();
    }
}
}

void ChatEventBinder::Bind(wxFrame& frame, Widgets widgets, Handlers handlers)
{
    widgets.input.Bind(wxEVT_TEXT_ENTER, [send = handlers.send](wxCommandEvent&) { InvokeChatHandler(send); });
    widgets.history.Bind(wxEVT_LISTBOX, [changed = handlers.historySelectionChanged](wxCommandEvent&) { InvokeChatHandler(changed); });
    widgets.history.Bind(
        wxEVT_LEFT_UP,
        [clicked = handlers.historyClicked](wxMouseEvent& event)
        {
            InvokeChatHandler(clicked);
            event.Skip();
        });
    widgets.history.Bind(wxEVT_LISTBOX_DCLICK, [activate = handlers.historyActivated](wxCommandEvent&) { InvokeChatHandler(activate); });
    widgets.editButton.Bind(wxEVT_BUTTON, [edit = handlers.editSelected](wxCommandEvent&) { InvokeChatHandler(edit); });
    widgets.deleteButton.Bind(wxEVT_BUTTON, [remove = handlers.deleteSelected](wxCommandEvent&) { InvokeChatHandler(remove); });

    const auto localKeyHandler = [escape = handlers.escape, activate = handlers.historyActivated](wxKeyEvent& event)
    {
        if (event.GetKeyCode() == WXK_ESCAPE)
        {
            InvokeChatHandler(escape);
            return;
        }
        if ((event.GetKeyCode() == WXK_RETURN || event.GetKeyCode() == WXK_NUMPAD_ENTER) && activate)
        {
            activate();
            return;
        }
        event.Skip();
    };

    widgets.input.Bind(
        wxEVT_CHAR_HOOK,
        [send = handlers.send, escape = handlers.escape](wxKeyEvent& event)
        {
            const int keyCode = event.GetKeyCode();
            if (keyCode == WXK_ESCAPE)
            {
                InvokeChatHandler(escape);
                return;
            }
            if (keyCode == WXK_RETURN || keyCode == WXK_NUMPAD_ENTER)
            {
                InvokeChatHandler(send);
                return;
            }
            event.Skip();
        });
    widgets.history.Bind(wxEVT_CHAR_HOOK, localKeyHandler);

    frame.Bind(
        wxEVT_CHAR_HOOK,
        [handlers](wxKeyEvent& event)
        {
            if (event.GetKeyCode() == WXK_ESCAPE)
            {
                InvokeChatHandler(handlers.escape);
                return;
            }
            event.Skip();
        });

    frame.Bind(
        wxEVT_CLOSE_WINDOW,
        [closeWindow = std::move(handlers.closeWindow)](wxCloseEvent& event)
        {
            if (event.CanVeto())
            {
                event.Veto();
            }
            event.Skip(false);
            InvokeChatHandler(closeWindow);
        });
}
}
