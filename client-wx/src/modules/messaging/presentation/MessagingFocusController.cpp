#include "modules/messaging/presentation/MessagingFocusController.h"

#include <utility>

#include <wx/button.h>
#include <wx/event.h>
#include <wx/listbox.h>
#include <wx/textctrl.h>
#include <wx/window.h>

#include "modules/messaging/presentation/MessagingView.h"
#include "shared/accessibility/application/FocusManager.h"
#include "shared/accessibility/application/NavigationController.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::messaging::presentation
{
namespace
{
using Navigator = lila::shared::accessibility::NavigationController;
using FocusManager = lila::shared::accessibility::FocusManager;

wxWindow* ResolveMessageListTarget(
    MessagingView& view,
    MessagingFocusController::SelectionSyncHandler onSelectionAdjusted)
{
    if (view.messagesList == nullptr || view.messagesList->GetCount() <= 0)
    {
        return view.emptyMessagesCtrl;
    }

    if (view.messagesList->GetSelection() == wxNOT_FOUND)
    {
        view.messagesList->SetSelection(0);
        if (onSelectionAdjusted)
        {
            onSelectionAdjusted();
        }
    }

    return view.messagesList;
}
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

lila::shared::accessibility::FocusManager::Plan MessagingFocusController::BuildCurrentScreenPlan()
{
    using Screen = MessagingNavigationState::Screen;
    FocusManager::Plan plan;

    switch (navigationState_.currentScreen)
    {
    case Screen::Menu:
        if (view_.menu != nullptr)
        {
            view_.menu->SetSelectedIndexSilently(navigationState_.lastMenuIndex);
            plan.AddWindow(view_.menu->GetFirstButton());
        }
        break;
    case Screen::List:
        plan.AddResolver([this]() { return ResolveMessageListTarget(view_, onSelectionAdjusted_); });
        break;
    case Screen::Detail:
        plan.AddWindow(view_.detailCtrl);
        break;
    case Screen::Compose:
        plan.AddWindow(view_.recipientCtrl);
        break;
    }

    return plan;
}

lila::shared::accessibility::FocusManager::Plan MessagingFocusController::BuildComposeRecipientPlan() const
{
    FocusManager::Plan plan;
    plan.AddWindow(view_.recipientCtrl);
    return plan;
}

lila::shared::accessibility::FocusManager::Plan MessagingFocusController::BuildComposeBodyPlan() const
{
    FocusManager::Plan plan;
    plan.AddWindow(view_.bodyCtrl);
    return plan;
}
}
