#include "shared/text/presentation/encoding/Encoding.h"
#include "modules/messaging/presentation/MessagingFrame.h"
#include "modules/messaging/presentation/MessagingFocusController.h"
#include "modules/messaging/presentation/MessagingPresentationModel.h"
#include "modules/messaging/presentation/MessagingScreenCoordinator.h"
#include "modules/messaging/presentation/MessagingView.h"
#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/accessibility/application/FocusCoordinator.h"
#include "shared/errors/catalog/CoreErrorMessages.h"
#include "shared/text/presentation/catalog/UiTexts.h"
#include "shared/ui/application/BackgroundTask.h"
#include "shared/ui/presentation/theme/Theme.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

#include <wx/button.h>
#include <wx/listbox.h>
#include <wx/simplebook.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

namespace lila::modules::messaging::presentation
{
void MessagingFrame::UpdateStatus(const wxString& message, bool isError)
{
    const auto shell = view_->Shell();
    shell.statusLabel->SetLabel(message);
    shell.statusLabel->SetForegroundColour(
        isError ? lila::shared::ui::Theme::Error() : lila::shared::ui::Theme::Accent());
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleStatus(*shell.statusLabel, message);
    Layout();
}

void MessagingFrame::RunBackgroundTask(
    const wxString& busyMessage,
    const std::function<void()>& worker,
    const std::function<void()>& onSuccess)
{
    if (isBusy_)
    {
        UpdateStatus(lila::shared::text::FromUtf8(lila::shared::errors::ActionInProgress), true);
        return;
    }

    SetBusyState(true, busyMessage);
    lila::shared::ui::RunManagedBackgroundTask(
        *this,
        worker,
        [](MessagingFrame& frame) { frame.SetBusyState(false); },
        [](MessagingFrame& frame, std::string errorMessage)
        {
            frame.UpdateStatus(lila::shared::text::FromUtf8(errorMessage), true);
        },
        [onSuccess](MessagingFrame&) { if (onSuccess) onSuccess(); });
}

void MessagingFrame::SetBusyState(bool busy, const wxString& message)
{
    isBusy_ = busy;
    if (busy && !message.empty())
    {
        UpdateStatus(message);
    }

    SyncBusyState();
}

void MessagingFrame::SyncBusyState()
{
    const auto compose = view_->Compose();
    const auto detail = view_->Detail();
    compose.sendComposeButton->Enable(!isBusy_);
    lila::shared::accessibility::AccessibilityUtils::SetSecondaryActionAvailability(
        detail.replyButton,
        detail.replyButton->IsShown() && !isBusy_);
    lila::shared::accessibility::AccessibilityUtils::SetSecondaryActionAvailability(
        detail.deleteButton,
        detail.deleteButton->IsShown() && !isBusy_);
    lila::shared::accessibility::AccessibilityUtils::SetSecondaryActionAvailability(
        detail.restoreButton,
        detail.restoreButton->IsShown() && !isBusy_);
    lila::shared::accessibility::AccessibilityUtils::SetSecondaryActionAvailability(
        detail.purgeButton,
        detail.purgeButton->IsShown() && !isBusy_);
}

void MessagingFrame::SyncPanels()
{
    const auto shell = view_->Shell();
    switch (navigationState_.currentScreen)
    {
    case Screen::Menu:
        shell.screenBook->SetSelection(0);
        break;
    case Screen::List:
        shell.screenBook->SetSelection(1);
        break;
    case Screen::Detail:
        shell.screenBook->SetSelection(2);
        break;
    case Screen::Compose:
        shell.screenBook->SetSelection(3);
        break;
    }
}

void MessagingFrame::SyncSelectionState()
{
    const auto list = view_->List();
    const auto detail = view_->Detail();
    const bool hasMessages = !boxMessages_.empty();
    list.messagesList->Show(hasMessages);
    list.emptyMessagesCtrl->Show(!hasMessages);

    const int selection = list.messagesList->GetSelection();
    if (hasMessages && selection >= 0 && static_cast<std::size_t>(selection) < boxMessages_.size())
    {
        selectionMemory_.Store(navigationState_.currentBox, boxMessages_[static_cast<std::size_t>(selection)].id);
    }
    else if (!hasMessages)
    {
        selectionMemory_.Clear(navigationState_.currentBox);
    }

    const auto selected = GetSelectedMessage();
    if (!selected.has_value())
    {
        detail.detailCtrl->SetValue(lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingNoMessage));
        lila::shared::accessibility::AccessibilityUtils::SetSecondaryActionAvailability(detail.replyButton, false);
        lila::shared::accessibility::AccessibilityUtils::SetSecondaryActionAvailability(detail.deleteButton, false);
        lila::shared::accessibility::AccessibilityUtils::SetSecondaryActionAvailability(detail.restoreButton, false);
        lila::shared::accessibility::AccessibilityUtils::SetSecondaryActionAvailability(detail.purgeButton, false);
        return;
    }

    detail.detailCtrl->SetValue(MessagingPresentationModel::BuildMessageDetail(*selected));
    const bool deleted = navigationState_.currentBox == domain::MessagingBox::Deleted;
    lila::shared::accessibility::AccessibilityUtils::SetSecondaryActionAvailability(
        detail.replyButton,
        !deleted && !isBusy_);
    lila::shared::accessibility::AccessibilityUtils::SetSecondaryActionAvailability(
        detail.deleteButton,
        !deleted && !isBusy_);
    lila::shared::accessibility::AccessibilityUtils::SetSecondaryActionAvailability(
        detail.restoreButton,
        deleted && !isBusy_);
    lila::shared::accessibility::AccessibilityUtils::SetSecondaryActionAvailability(
        detail.purgeButton,
        deleted && !isBusy_);
}

void MessagingFrame::SetScreen(Screen screen, std::optional<Screen> previousScreen)
{
    const Screen activeScreen = previousScreen.value_or(navigationState_.currentScreen);
    if (activeScreen == Screen::List)
    {
        screenCoordinator_->SaveCurrentBoxSelection();
    }

    if (screen == Screen::Menu)
    {
        const auto shell = view_->Shell();
        if (shell.menu != nullptr)
        {
            shell.menu->SetSelectedIndexSilently(navigationState_.lastMenuIndex);
        }
    }

    if (screen == Screen::List)
    {
        screenCoordinator_->RestoreCurrentBoxSelection();
    }

    navigationState_.Enter(screen);
    SyncPanels();
    SyncSelectionState();
    ScheduleFocusCurrentScreen();
}

void MessagingFrame::ScheduleFocusCurrentScreen()
{
    lila::shared::accessibility::FocusCoordinator::Schedule(
        *this,
        [this]()
        {
            return focusController_->BuildCurrentScreenPlan();
        });
}

bool MessagingFrame::NavigateBack(bool preserveCurrentBox)
{
    const Screen previousScreen = navigationState_.currentScreen;
    if (!navigationState_.GoBack(preserveCurrentBox))
    {
        return false;
    }

    SetScreen(navigationState_.currentScreen, previousScreen);
    return true;
}
}
