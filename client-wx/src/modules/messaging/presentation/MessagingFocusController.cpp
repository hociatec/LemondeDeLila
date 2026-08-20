#include "modules/messaging/presentation/MessagingFocusController.h"

#include <utility>

#include <wx/button.h>
#include <wx/event.h>
#include <wx/listbox.h>
#include <wx/textctrl.h>
#include <wx/window.h>

#include "modules/messaging/presentation/MessagingView.h"
#include "shared/accessibility/NavigationController.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::messaging::presentation
{
namespace
{
using Navigator = lila::shared::accessibility::NavigationController;
}

MessagingFocusController::MessagingFocusController(
    MessagingView& view,
    MessagingNavigationState& navigationState,
    SelectionSyncHandler onSelectionAdjusted)
    : view_(view), navigationState_(navigationState), onSelectionAdjusted_(std::move(onSelectionAdjusted))
{
}

void MessagingFocusController::BindNavigation(wxWindow& owner)
{
    Navigator::BindTabNavigation(
        owner,
        [this]()
        {
            Navigator::Scope scope;
            if (navigationState_.currentScreen == MessagingNavigationState::Screen::Compose)
            {
                scope.Add({view_.recipientCtrl, view_.subjectCtrl, view_.bodyCtrl, view_.sendComposeButton, view_.cancelComposeButton});
            }
            else if (navigationState_.currentScreen == MessagingNavigationState::Screen::Detail)
            {
                scope.Add({view_.detailCtrl, view_.replyButton, view_.deleteButton, view_.restoreButton, view_.purgeButton});
            }
            return scope;
        },
        [this]()
        {
            return navigationState_.currentScreen == MessagingNavigationState::Screen::Compose ||
                   navigationState_.currentScreen == MessagingNavigationState::Screen::Detail;
        });
}

void MessagingFocusController::FocusCurrentScreen()
{
    using Screen = MessagingNavigationState::Screen;
    switch (navigationState_.currentScreen)
    {
    case Screen::Menu:
        if (view_.menu != nullptr)
        {
            view_.menu->SetSelectedIndexSilently(navigationState_.lastMenuIndex);
            view_.menu->FocusSelectedItem();
        }
        return;
    case Screen::List:
        if (view_.messagesList->GetCount() > 0)
        {
            if (view_.messagesList->GetSelection() == wxNOT_FOUND)
            {
                view_.messagesList->SetSelection(0);
                if (onSelectionAdjusted_) onSelectionAdjusted_();
            }
            static_cast<void>(Navigator::Focus(view_.messagesList));
        }
        else
        {
            static_cast<void>(Navigator::Focus(view_.emptyMessagesCtrl));
        }
        return;
    case Screen::Detail:
        static_cast<void>(Navigator::Focus(view_.detailCtrl));
        return;
    case Screen::Compose:
        static_cast<void>(Navigator::Focus(view_.recipientCtrl));
        return;
    }
}
}
