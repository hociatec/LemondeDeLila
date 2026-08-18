#include "shared/text/Encoding.h"
#include "modules/messaging/presentation/MessagingFrame.h"
#include "modules/messaging/presentation/MessagingView.h"
#include "modules/messaging/presentation/MessagingPresentationModel.h"
#include "modules/messaging/presentation/MessagingActionController.h"
#include "modules/messaging/presentation/MessagingMailboxController.h"
#include "modules/messaging/presentation/MessagingFocusController.h"
#include "shared/ui/BackgroundTask.h"

#include <array>
#include <memory>
#include <utility>

#include <wx/app.h>
#include <wx/button.h>
#include <wx/listbox.h>
#include <wx/msgdlg.h>
#include <wx/panel.h>
#include <wx/simplebook.h>
#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>
#include <wx/weakref.h>

#include "modules/messaging/application/MessagingService.h"
#include "shared/accessibility/NonFocusablePanel.h"
#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/config/AppConfig.h"
#include "shared/ui/Theme.h"
#include "shared/ui/controls/VerticalMenu.h"
#include "shared/ui/navigation/MenuBlueprint.h"

namespace
{
constexpr int WindowWidth = 1180;
constexpr int WindowHeight = 780;
}

namespace lila::modules::messaging::presentation
{
MessagingFrame::~MessagingFrame() = default;

MessagingFrame::MessagingFrame(
    lila::modules::messaging::application::MessagingService& messagingService,
    CloseRequestedHandler onCloseRequested,
    ExitRequestedHandler onExitRequested)
    : wxFrame(
          nullptr,
          wxID_ANY,
          wxString::Format(
              lila::shared::text::FromUtf8(lila::shared::errors::MessagingFrameTitle),
              lila::shared::text::FromUtf8(shared::config::AppConfig::AppTitle.data())),
      wxDefaultPosition,
      wxSize(WindowWidth, WindowHeight),
      wxDEFAULT_FRAME_STYLE),
      onCloseRequested_(std::move(onCloseRequested)),
      onExitRequested_(std::move(onExitRequested))
{
    view_ = new MessagingView(this);
    auto* frameSizer = new wxBoxSizer(wxVERTICAL);
    frameSizer->Add(view_, 1, wxEXPAND);
    SetSizer(frameSizer);
    view_->ApplyTheme();
    mailboxController_ = std::make_unique<MessagingMailboxController>(messagingService);
    focusController_ = std::make_unique<MessagingFocusController>(*view_, navigationState_, [this]() { SyncSelectionState(); });
    actionController_ = std::make_unique<MessagingActionController>(
        messagingService,
        MessagingActionController::Callbacks{
            [this](const char* busyMessage, std::function<void()> worker, std::function<void()> onSuccess)
            {
                RunBackgroundTask(lila::shared::text::FromUtf8(busyMessage), worker, onSuccess);
            },
            [this](const char* confirmationMessage, bool warning)
            {
                const long style = wxYES_NO | wxNO_DEFAULT | (warning ? wxICON_WARNING : wxICON_QUESTION);
                return wxMessageBox(
                    lila::shared::text::FromUtf8(confirmationMessage),
                    lila::shared::text::FromUtf8(lila::shared::errors::MessagingFrameHeader),
                    style,
                    this) == wxYES;
            },
            [this](const char* message)
            {
                const wxString text = lila::shared::text::FromUtf8(message);
                UpdateStatus(text);
                wxMessageBox(
                    text,
                    lila::shared::text::FromUtf8(lila::shared::errors::MessagingFrameHeader),
                    wxOK | wxICON_INFORMATION,
                    this);
            },
            [this]()
            {
                RefreshCurrentBox(false);
            }});
    BindEvents();

    if (view_->menu != nullptr)
    {
        view_->menu->SetTabNavigationEnabled(false);
        view_->menu->SetSelectedIndex(navigationState_.lastMenuIndex);
    }

    SetScreen(Screen::Menu);
    UpdateStatus(lila::shared::text::FromUtf8(lila::shared::errors::KeyboardNavigationHint));
    CentreOnScreen();
    CallAfter(
        [this]()
        {
            focusController_->FocusCurrentScreen();
        });
}





void MessagingFrame::UpdateStatus(const wxString& message, bool isError)
{
    view_->statusLabel->SetLabel(message);
    view_->statusLabel->SetForegroundColour(
        isError ? lila::shared::ui::Theme::Error() : lila::shared::ui::Theme::Accent());
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleStatus(*view_->statusLabel, message);
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
    wxWeakRef<MessagingFrame> weakSelf(this);
    lila::shared::ui::RunBackgroundTask(
        this,
        worker,
        [weakSelf, onSuccess](std::string errorMessage) mutable
        {
            if (!weakSelf)
            {
                return;
            }

            weakSelf->SetBusyState(false);
            if (!errorMessage.empty())
            {
                weakSelf->UpdateStatus(lila::shared::text::FromUtf8(errorMessage), true);
                return;
            }

            if (onSuccess)
            {
                onSuccess();
            }
        });
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
    view_->sendComposeButton->Enable(!isBusy_);
    view_->replyButton->Enable(!isBusy_ && view_->replyButton->IsShown());
    view_->deleteButton->Enable(!isBusy_ && view_->deleteButton->IsShown());
    view_->restoreButton->Enable(!isBusy_ && view_->restoreButton->IsShown());
    view_->purgeButton->Enable(!isBusy_ && view_->purgeButton->IsShown());
}

void MessagingFrame::SyncPanels()
{
    switch (navigationState_.currentScreen)
    {
    case Screen::Menu:
        view_->screenBook->SetSelection(0);
        break;
    case Screen::List:
        view_->screenBook->SetSelection(1);
        break;
    case Screen::Detail:
        view_->screenBook->SetSelection(2);
        break;
    case Screen::Compose:
        view_->screenBook->SetSelection(3);
        break;
    }
}

void MessagingFrame::SyncSelectionState()
{
    const bool hasMessages = !boxMessages_.empty();
    view_->messagesList->Show(hasMessages);
    view_->emptyMessagesCtrl->Show(!hasMessages);

    const int selection = view_->messagesList->GetSelection();
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
        view_->detailCtrl->SetValue(lila::shared::text::FromUtf8(lila::shared::errors::MessagingNoMessage));
        view_->replyButton->Show(false);
        view_->deleteButton->Show(false);
        view_->restoreButton->Show(false);
        view_->purgeButton->Show(false);
        return;
    }

    view_->detailCtrl->SetValue(MessagingPresentationModel::BuildMessageDetail(*selected));
    const bool deleted = navigationState_.currentBox == domain::MessagingBox::Deleted;
    view_->replyButton->Show(!deleted);
    view_->deleteButton->Show(!deleted);
    view_->restoreButton->Show(deleted);
    view_->purgeButton->Show(deleted);
}

void MessagingFrame::SetScreen(Screen screen)
{
    if (navigationState_.currentScreen == Screen::List)
    {
        SaveCurrentBoxSelection();
    }

    if (screen == Screen::Menu)
    {
        if (view_->menu != nullptr)
        {
            view_->menu->SetSelectedIndex(navigationState_.lastMenuIndex);
        }
    }

    if (screen == Screen::List)
    {
        RestoreCurrentBoxSelection();
    }

    navigationState_.Enter(screen);
    SyncPanels();
    SyncSelectionState();
    CallAfter(
        [this]()
        {
            focusController_->FocusCurrentScreen();
        });
}

}

#include "modules/messaging/presentation/MessagingView.inl"
#include "modules/messaging/presentation/MessagingSelectionMemory.inl"
#include "modules/messaging/presentation/MessagingActionController.inl"
