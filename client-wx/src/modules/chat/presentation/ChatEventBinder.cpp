#include "modules/chat/presentation/ChatEventBinder.h"

#include <utility>

#include <wx/button.h>
#include <wx/event.h>
#include <wx/textctrl.h>
#include <wx/weakref.h>
#include <wx/window.h>

#include "shared/accessibility/application/NavigationController.h"
#include "shared/accessibility/presentation/AccessibilityUtils.h"

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
    widgets.input.Bind(
        wxEVT_SET_FOCUS,
        [focused = handlers.inputFocused](wxFocusEvent& event)
        {
            InvokeChatHandler(focused);
            event.Skip();
        });
    widgets.history.Bind(
        wxEVT_SET_FOCUS,
        [&history = widgets.history,
         focused = handlers.historyFocused,
         changed = handlers.historySelectionChanged](wxFocusEvent& event)
        {
            history.SetInsertionPointEnd();
            history.ShowPosition(history.GetLastPosition());
            InvokeChatHandler(focused);
            InvokeChatHandler(changed);
            // Windows can restore the native focus without sending a usable
            // accessibility focus event after the application is reactivated.
            // Re-announce the named history control once that restoration has
            // settled, so screen readers do not report an unknown focus.
            const wxWeakRef<wxTextCtrl> weakHistory(&history);
            history.CallAfter(
                [weakHistory]()
                {
                    auto* restoredHistory = weakHistory.get();
                    if (restoredHistory != nullptr && wxWindow::FindFocus() == restoredHistory)
                        lila::shared::accessibility::AccessibilityUtils::NotifyFocus(*restoredHistory);
                });
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
