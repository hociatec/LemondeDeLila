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
    if (view.menu == nullptr)
    {
        return;
    }

    lila::shared::ui::navigation::BindMenuHandlers(
        *view.menu,
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

    view.messagesList->Bind(wxEVT_LISTBOX, [syncSelection = handlers.syncSelection](wxCommandEvent&) { Invoke(syncSelection); });
    view.messagesList->Bind(wxEVT_LISTBOX_DCLICK, [openDetail = handlers.openDetail](wxCommandEvent&) { Invoke(openDetail); });

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
    view.messagesList->Bind(wxEVT_CHAR_HOOK, listKeyHandler);
    view.messagesList->Bind(wxEVT_KEY_DOWN, listKeyHandler);

    view.replyButton->Bind(wxEVT_BUTTON, [reply = handlers.reply](wxCommandEvent&) { Invoke(reply); });
    view.deleteButton->Bind(wxEVT_BUTTON, [deleteMessage = handlers.deleteMessage](wxCommandEvent&) { Invoke(deleteMessage); });
    view.restoreButton->Bind(wxEVT_BUTTON, [restoreMessage = handlers.restoreMessage](wxCommandEvent&) { Invoke(restoreMessage); });
    view.purgeButton->Bind(wxEVT_BUTTON, [purgeMessage = handlers.purgeMessage](wxCommandEvent&) { Invoke(purgeMessage); });
    view.sendComposeButton->Bind(wxEVT_BUTTON, [sendCompose = handlers.sendCompose](wxCommandEvent&) { Invoke(sendCompose); });
    view.cancelComposeButton->Bind(wxEVT_BUTTON, [closeCompose = handlers.closeCompose](wxCommandEvent&) { Invoke(closeCompose); });

    view.bodyCtrl->Bind(
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


    frame.Bind(
        wxEVT_CHAR_HOOK,
        [&view, &navigationState, &focusController, handlers](wxKeyEvent& event)
        {
            const int key = event.GetKeyCode();
            using Screen = MessagingNavigationState::Screen;
            if (key == WXK_ESCAPE)
            {
                switch (navigationState.currentScreen)
                {
                case Screen::Menu: Invoke(handlers.closeFrame); return;
                case Screen::List: Invoke(handlers.showMenu); return;
                case Screen::Detail: Invoke(handlers.showList); return;
                case Screen::Compose: Invoke(handlers.closeCompose); return;
                }
            }

            if (key == WXK_RETURN || key == WXK_NUMPAD_ENTER)
            {
                if (navigationState.currentScreen == Screen::Menu && view.menu != nullptr)
                {
                    if (handlers.openMenu)
                    {
                        handlers.openMenu(view.menu->GetSelectedIndex());
                    }
                    return;
                }
                if (navigationState.currentScreen == Screen::List)
                {
                    Invoke(handlers.openDetail);
                    return;
                }
            }

            event.Skip();
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
