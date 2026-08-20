#include "modules/messaging/presentation/MessagingEventBinder.h"

#include <utility>

#include <wx/button.h>
#include <wx/event.h>
#include <wx/frame.h>
#include <wx/listbox.h>
#include <wx/textctrl.h>

#include "modules/messaging/domain/MessagingBox.h"
#include "modules/messaging/presentation/MessagingFocusController.h"
#include "modules/messaging/presentation/MessagingNavigationState.h"
#include "modules/messaging/presentation/MessagingView.h"
#include "shared/accessibility/NavigationController.h"
#include "shared/ui/controls/VerticalMenu.h"
#include "shared/ui/navigation/MenuBlueprint.h"

namespace lila::modules::messaging::presentation
{
namespace
{
void Invoke(const std::function<void()>& handler)
{
    if (handler)
    {
        handler();
    }
}
}

void MessagingEventBinder::Bind(
    wxFrame& frame,
    MessagingView& view,
    MessagingNavigationState& navigationState,
    MessagingFocusController& focusController,
    Handlers handlers)
{
    const auto shell = view.Shell();
    const auto list = view.List();
    const auto detail = view.Detail();
    const auto compose = view.Compose();
    if (shell.menu == nullptr)
    {
        return;
    }

    lila::shared::ui::navigation::BindMenuHandlers(
        *shell.menu,
        [selectionChanged = handlers.menuSelectionChanged](std::size_t index)
        {
            if (selectionChanged)
            {
                selectionChanged(index);
            }
        },
        [openMenu = handlers.openMenu](std::size_t index)
        {
            if (openMenu)
            {
                openMenu(index);
            }
        });

    list.messagesList->Bind(wxEVT_LISTBOX, [syncSelection = handlers.syncSelection](wxCommandEvent&) { Invoke(syncSelection); });
    list.messagesList->Bind(wxEVT_LISTBOX_DCLICK, [openDetail = handlers.openDetail](wxCommandEvent&) { Invoke(openDetail); });

    const auto listKeyHandler = [&navigationState, handlers](wxKeyEvent& event)
    {
        const int key = event.GetKeyCode();
        if (key == WXK_RETURN || key == WXK_NUMPAD_ENTER)
        {
            Invoke(handlers.openDetail);
            return;
        }
        if (key == WXK_DELETE)
        {
            if (navigationState.currentBox == domain::MessagingBox::Deleted)
            {
                Invoke(handlers.purgeMessage);
            }
            else
            {
                Invoke(handlers.deleteMessage);
            }
            return;
        }
        event.Skip();
    };
    list.messagesList->Bind(wxEVT_CHAR_HOOK, listKeyHandler);

    detail.replyButton->Bind(wxEVT_BUTTON, [reply = handlers.reply](wxCommandEvent&) { Invoke(reply); });
    detail.deleteButton->Bind(wxEVT_BUTTON, [deleteMessage = handlers.deleteMessage](wxCommandEvent&) { Invoke(deleteMessage); });
    detail.restoreButton->Bind(wxEVT_BUTTON, [restoreMessage = handlers.restoreMessage](wxCommandEvent&) { Invoke(restoreMessage); });
    detail.purgeButton->Bind(wxEVT_BUTTON, [purgeMessage = handlers.purgeMessage](wxCommandEvent&) { Invoke(purgeMessage); });
    compose.sendComposeButton->Bind(wxEVT_BUTTON, [sendCompose = handlers.sendCompose](wxCommandEvent&) { Invoke(sendCompose); });
    compose.cancelComposeButton->Bind(wxEVT_BUTTON, [closeCompose = handlers.closeCompose](wxCommandEvent&) { Invoke(closeCompose); });

    compose.bodyCtrl->Bind(
        wxEVT_CHAR_HOOK,
        [sendCompose = handlers.sendCompose, canSendCompose = handlers.canSendCompose](wxKeyEvent& event)
        {
            const int key = event.GetKeyCode();
            if ((key == WXK_RETURN || key == WXK_NUMPAD_ENTER) && !event.ShiftDown() && !event.ControlDown()
                && (!canSendCompose || canSendCompose()))
            {
                Invoke(sendCompose);
                return;
            }
            event.Skip();
        });

    lila::shared::accessibility::NavigationController::BindEscapeNavigation(
        frame,
        [&navigationState, handlers]()
        {
            if (navigationState.currentScreen == MessagingNavigationState::Screen::Menu)
            {
                Invoke(handlers.closeFrame);
                return true;
            }

            return handlers.goBack ? handlers.goBack() : false;
        });

    focusController.BindNavigation(frame);

    frame.Bind(
        wxEVT_CLOSE_WINDOW,
        [exitFrame = std::move(handlers.exitFrame)](wxCloseEvent& event)
        {
            if (event.CanVeto())
            {
                event.Veto();
            }
            Invoke(exitFrame);
        });
}
}
