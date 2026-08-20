#include "shared/text/Encoding.h"
#include "modules/messaging/presentation/MessagingFrame.h"
#include "modules/messaging/presentation/MessagingView.h"
#include "modules/messaging/presentation/MessagingPresentationModel.h"
#include "modules/messaging/presentation/MessagingActionController.h"
#include "modules/messaging/presentation/MessagingComposeController.h"
#include "modules/messaging/presentation/MessagingMailboxController.h"
#include "modules/messaging/presentation/MessagingFocusController.h"
#include "modules/messaging/presentation/MessagingScreenCoordinator.h"
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
#include "shared/text/UiTexts.h"
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
              lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingFrameTitle),
              lila::shared::text::FromUtf8(shared::config::AppConfig::AppTitle.data()).wc_str()),
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
    screenCoordinator_ = std::make_unique<MessagingScreenCoordinator>(
        *mailboxController_,
        navigationState_,
        selectionMemory_,
        boxMessages_,
        *view_,
        MessagingScreenCoordinator::Callbacks{
            [this](const wxString& busyMessage, const std::function<void()>& worker, const std::function<void()>& onSuccess)
            {
                RunBackgroundTask(busyMessage, worker, onSuccess);
            },
            [this](const wxString& message, bool isError)
            {
                UpdateStatus(message, isError);
            },
            [this](Screen screen)
            {
                SetScreen(screen);
            },
            [this]()
            {
                focusController_->FocusCurrentScreen();
            }});
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
                    lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingFrameHeader),
                    style,
                    this) == wxYES;
            },
            [this](const char* message)
            {
                const wxString text = lila::shared::text::FromUtf8(message);
                UpdateStatus(text);
                wxMessageBox(
                    text,
                    lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingFrameHeader),
                    wxOK | wxICON_INFORMATION,
                    this);
            },
            [this]()
            {
                RefreshCurrentBox(false);
            }});
    composeController_ = std::make_unique<MessagingComposeController>(
        *mailboxController_,
        MessagingComposeController::Callbacks{
            [this](const char* busyMessage, std::function<void()> worker, std::function<void()> onSuccess)
            {
                RunBackgroundTask(lila::shared::text::FromUtf8(busyMessage), worker, onSuccess);
            },
            [this](const char* statusMessage, bool isError)
            {
                UpdateStatus(lila::shared::text::FromUtf8(statusMessage), isError);
            },
            [this](const char* confirmationTemplate, const std::string& recipientName)
            {
                const wxString confirmation = wxString::Format(
                    lila::shared::text::FromUtf8(confirmationTemplate),
                    lila::shared::text::FromUtf8(recipientName));
                UpdateStatus(confirmation);
                wxMessageBox(
                    confirmation,
                    lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingFrameHeader),
                    wxOK | wxICON_INFORMATION,
                    this);
            },
            [this]()
            {
                if (navigationState_.currentBox != domain::MessagingBox::Outbox)
                {
                    navigationState_.currentBox = domain::MessagingBox::Outbox;
                }
                CloseCompose(true);
            },
            [this]()
            {
                LoadBox(navigationState_.currentBox, false);
            }});
    BindEvents();

    const auto shell = view_->Shell();
    if (shell.menu != nullptr)
    {
        shell.menu->SetTabNavigationEnabled(false);
        shell.menu->SetSelectedIndexSilently(navigationState_.lastMenuIndex);
    }

    SetScreen(Screen::Menu);
    UpdateStatus(lila::shared::text::FromUtf8(lila::shared::text::ui::KeyboardNavigationHint));
    CentreOnScreen();
    CallAfter(
        [this]()
        {
            focusController_->FocusCurrentScreen();
        });
}
}

