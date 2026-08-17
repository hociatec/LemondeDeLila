#include "modules/social/presentation/SocialFrame.h"
#include "shared/ui/BackgroundTask.h"

#include <stdexcept>
#include <thread>
#include <utility>

#include <wx/app.h>
#include <wx/button.h>
#include <wx/choice.h>
#include <wx/msgdlg.h>
#include <wx/panel.h>
#include <wx/textctrl.h>
#include <wx/weakref.h>

#include "modules/social/application/SocialService.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/config/AppConfig.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace
{
constexpr int WindowWidth = 1180;
constexpr int WindowHeight = 780;
}

namespace lila::modules::social::presentation
{
SocialFrame::SocialFrame(
    lila::modules::social::application::SocialService& socialService,
    OpenMessagingRequestedHandler onOpenMessagingRequested,
    CloseRequestedHandler onCloseRequested,
    ExitRequestedHandler onExitRequested,
    std::size_t initialSelectedMenuIndex)
    : wxFrame(
          nullptr,
          wxID_ANY,
          wxString::Format(
              wxString::FromUTF8(lila::shared::errors::SocialFrameTitle),
              wxString::FromUTF8(shared::config::AppConfig::AppTitle.data())),
          wxDefaultPosition,
          wxSize(WindowWidth, WindowHeight),
          wxDEFAULT_FRAME_STYLE),
      socialService_(socialService),
      onOpenMessagingRequested_(std::move(onOpenMessagingRequested)),
      onCloseRequested_(std::move(onCloseRequested)),
      onExitRequested_(std::move(onExitRequested)),
      lastMenuIndex_(initialSelectedMenuIndex)
{
    BuildLayout();
    ApplyTheme();
    BindEvents();

    if (menu_ != nullptr && menu_->GetItemCount() > 0)
    {
        menu_->SetTabNavigationEnabled(false);
        if (lastMenuIndex_ >= menu_->GetItemCount())
        {
            lastMenuIndex_ = 0;
        }

        menu_->SetSelectedIndex(lastMenuIndex_);
    }

    if (profileMenu_ != nullptr)
    {
        profileMenu_->SetTabNavigationEnabled(false);
    }

    if (friendsActionsMenu_ != nullptr)
    {
        friendsActionsMenu_->SetTabNavigationEnabled(false);
    }

    if (incomingActionsMenu_ != nullptr)
    {
        incomingActionsMenu_->SetTabNavigationEnabled(false);
    }

    if (outgoingActionsMenu_ != nullptr)
    {
        outgoingActionsMenu_->SetTabNavigationEnabled(false);
    }

    if (blockedActionsMenu_ != nullptr)
    {
        blockedActionsMenu_->SetTabNavigationEnabled(false);
    }

    SetScreen(Screen::Menu);
    UpdateStatus(wxString::FromUTF8(lila::shared::errors::KeyboardNavigationHint));
    CentreOnScreen();
    CallAfter(
        [this]()
        {
            FocusCurrentScreen();
        });
}

void SocialFrame::RunUiAction(const std::function<void()>& action)
{
    try
    {
        action();
    }
    catch (const std::exception& error)
    {
        UpdateStatus(wxString::FromUTF8(error.what()), true);
    }
}

void SocialFrame::ShowActionFeedback(const wxString& message, const wxString& title)
{
    UpdateStatus(message);
    wxMessageBox(message, title, wxOK | wxICON_INFORMATION, this);
}

void SocialFrame::RunBackgroundTask(
    const wxString& busyMessage,
    const std::function<void()>& worker,
    const std::function<void()>& onSuccess)
{
    if (isBusy_)
    {
        UpdateStatus(wxString::FromUTF8(lila::shared::errors::ActionInProgress), true);
        return;
    }

    SetBusyState(true, busyMessage);
    wxWeakRef<SocialFrame> weakSelf(this);
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
                weakSelf->UpdateStatus(wxString::FromUTF8(errorMessage), true);
                return;
            }

            if (onSuccess)
            {
                weakSelf->RunUiAction(onSuccess);
            }
        });
}

void SocialFrame::SetBusyState(bool busy, const wxString& message)
{
    isBusy_ = busy;
    if (busy && !message.empty())
    {
        UpdateStatus(message);
    }

    ApplyBusyState();
}

void SocialFrame::ApplyBusyState()
{
    // Ne pas désactiver les contrôles pendant les chargements :
    // le lecteur d'écran annonce alors "indisponible" sur les écrans sociaux.
}
}

