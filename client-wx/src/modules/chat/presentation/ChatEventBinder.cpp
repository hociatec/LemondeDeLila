#include "modules/chat/presentation/ChatEventBinder.h"

#include <utility>

#include <wx/button.h>
#include <wx/event.h>
#include <wx/textctrl.h>
#include <wx/window.h>

#include "shared/accessibility/application/NavigationController.h"

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

void ChatEventBinder::Bind(wxWindow& owner, Widgets widgets, Handlers handlers)
{
    widgets.input.Bind(wxEVT_TEXT_ENTER, [send = handlers.send](wxCommandEvent&) { InvokeChatHandler(send); });
    widgets.history.Bind(
        wxEVT_SET_FOCUS,
        [&history = widgets.history, changed = handlers.historySelectionChanged](wxFocusEvent& event)
        {
            history.SetInsertionPointEnd();
            history.ShowPosition(history.GetLastPosition());
            InvokeChatHandler(changed);
            event.Skip();
        });
    widgets.history.Bind(
        wxEVT_LEFT_UP,
        [&history = widgets.history, clicked = handlers.historyClicked](wxMouseEvent& event)
        {
            event.Skip();
            history.CallAfter([clicked]() { InvokeChatHandler(clicked); });
        });
    widgets.history.Bind(
        wxEVT_LEFT_DCLICK,
        [&history = widgets.history, activate = handlers.historyActivated](wxMouseEvent& event)
        {
            event.Skip();
            history.CallAfter([activate]() { InvokeChatHandler(activate); });
        });
    widgets.editButton.Bind(wxEVT_BUTTON, [edit = handlers.editSelected](wxCommandEvent&) { InvokeChatHandler(edit); });
    widgets.deleteButton.Bind(wxEVT_BUTTON, [remove = handlers.deleteSelected](wxCommandEvent&) { InvokeChatHandler(remove); });

    const auto localKeyHandler = [activate = handlers.historyActivated](wxKeyEvent& event)
    {
        if ((event.GetKeyCode() == WXK_RETURN || event.GetKeyCode() == WXK_NUMPAD_ENTER) && activate)
        {
            activate();
            return;
        }
        event.Skip();
    };

    widgets.input.Bind(
        wxEVT_CHAR_HOOK,
        [send = handlers.send](wxKeyEvent& event)
        {
            const int keyCode = event.GetKeyCode();
            if (keyCode == WXK_RETURN || keyCode == WXK_NUMPAD_ENTER)
            {
                InvokeChatHandler(send);
                return;
            }
            event.Skip();
        });
    widgets.history.Bind(wxEVT_CHAR_HOOK, localKeyHandler);
    widgets.history.Bind(
        wxEVT_KEY_UP,
        [changed = handlers.historySelectionChanged](wxKeyEvent& event)
        {
            switch (event.GetKeyCode())
            {
            case WXK_UP:
            case WXK_DOWN:
            case WXK_LEFT:
            case WXK_RIGHT:
            case WXK_HOME:
            case WXK_END:
            case WXK_PAGEUP:
            case WXK_PAGEDOWN:
                InvokeChatHandler(changed);
                break;
            default:
                break;
            }
            event.Skip();
        });

    lila::shared::accessibility::NavigationController::BindEscapeNavigation(
        owner,
        [handlers]()
        {
            InvokeChatHandler(handlers.escape);
            return true;
        });
}
}
