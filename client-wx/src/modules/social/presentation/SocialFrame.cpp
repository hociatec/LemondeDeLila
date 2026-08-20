#include "shared/text/Encoding.h"
#include "modules/social/presentation/SocialFrame.h"
#include "modules/social/presentation/SocialActionController.h"
#include "modules/social/presentation/SocialLoadController.h"
#include "modules/social/presentation/SocialFocusController.h"
#include "modules/social/presentation/SocialSectionCoordinator.h"
#include "modules/social/presentation/SocialSectionPresenter.h"
#include "modules/social/presentation/SocialView.h"
#include "shared/ui/BackgroundTask.h"

#include <memory>
#include <stdexcept>
#include <utility>

#include <wx/app.h>
#include <wx/button.h>
#include <wx/choice.h>
#include <wx/msgdlg.h>
#include <wx/sizer.h>
#include <wx/panel.h>
#include <wx/textctrl.h>
#include <wx/weakref.h>

#include "modules/social/application/SocialService.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/logging/Logger.h"
#include "shared/text/UiTexts.h"
#include "shared/config/AppConfig.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace
{
constexpr int WindowWidth = 1180;
constexpr int WindowHeight = 780;
}

namespace lila::modules::social::presentation
{
SocialFrame::~SocialFrame() = default;

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
              lila::shared::text::FromUtf8(lila::shared::text::ui::SocialFrameTitle),
              lila::shared::text::FromUtf8(shared::config::AppConfig::AppTitle.data()).wc_str()),
          wxDefaultPosition,
          wxSize(WindowWidth, WindowHeight),
          wxDEFAULT_FRAME_STYLE),
      onOpenMessagingRequested_(std::move(onOpenMessagingRequested)),
      onCloseRequested_(std::move(onCloseRequested)),
      onExitRequested_(std::move(onExitRequested)),
      navigationState_(initialSelectedMenuIndex)
{
    view_ = new SocialView(this);
    auto* frameSizer = new wxBoxSizer(wxVERTICAL);
    frameSizer->Add(view_, 1, wxEXPAND);
    SetSizer(frameSizer);
    view_->ApplyTheme();
    loadController_ = std::make_unique<SocialLoadController>(socialService);
    sectionPresenter_ = std::make_unique<SocialSectionPresenter>(
        *this, *view_, dataStore_, navigationState_, selectionMemory_);
    focusController_ = std::make_unique<SocialFocusController>(
        *view_, navigationState_, [this]() { sectionPresenter_->SyncSelectionState(); });
    sectionCoordinator_ = std::make_unique<SocialSectionCoordinator>(
        *loadController_,
        dataStore_,
        navigationState_,
        *sectionPresenter_,
        *view_,
        SocialSectionCoordinator::Callbacks{
            [this](const wxString& busyMessage, const std::function<void()>& worker, const std::function<void()>& onSuccess)
            {
                RunBackgroundTask(busyMessage, worker, onSuccess);
            },
            [this](const wxString& message, bool isError)
            {
                UpdateStatus(message, isError);
            },
            [this]()
            {
                focusController_->FocusCurrentScreen();
            }});
    actionController_ = std::make_unique<SocialActionController>(
        socialService,
        SocialActionController::Callbacks{
            [this](const char* busyMessage, std::function<void()> worker, std::function<void()> onSuccess)
            {
                RunBackgroundTask(lila::shared::text::FromUtf8(busyMessage), worker, onSuccess);
            },
            [this](int userId)
            {
                OpenProfile(userId);
            },
            [this]()
            {
                UpdateStatus(lila::shared::text::FromUtf8(lila::shared::text::ui::SocialSelectPlayerToAct), true);
            },
            [this](const char* message)
            {
                ShowActionFeedback(lila::shared::text::FromUtf8(message));
            },
            [this](SocialSection section)
            {
                RefreshSection(section);
            }});
    BindEvents();

    const auto shell = view_->Shell();
    const auto profile = view_->Profile();
    const auto friends = view_->FriendsSection();
    const auto incoming = view_->IncomingSection();
    const auto outgoing = view_->OutgoingSection();
    const auto blocked = view_->BlockedSection();

    if (shell.menu != nullptr && shell.menu->GetItemCount() > 0)
    {
        shell.menu->SetTabNavigationEnabled(false);
        if (navigationState_.lastMenuIndex >= shell.menu->GetItemCount())
        {
            navigationState_.lastMenuIndex = 0;
        }

        shell.menu->SetSelectedIndexSilently(navigationState_.lastMenuIndex);
    }

    if (profile.profileMenu != nullptr)
    {
        profile.profileMenu->SetTabNavigationEnabled(false);
    }

    if (friends.actionsMenu != nullptr)
    {
        friends.actionsMenu->SetTabNavigationEnabled(false);
    }

    if (incoming.actionsMenu != nullptr)
    {
        incoming.actionsMenu->SetTabNavigationEnabled(false);
    }

    if (outgoing.actionsMenu != nullptr)
    {
        outgoing.actionsMenu->SetTabNavigationEnabled(false);
    }

    if (blocked.actionsMenu != nullptr)
    {
        blocked.actionsMenu->SetTabNavigationEnabled(false);
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

void SocialFrame::RunUiAction(const std::function<void()>& action)
{
    try
    {
        action();
    }
    catch (const std::exception& error)
    {
        lila::shared::logging::LogError("Social", error.what());
        UpdateStatus(lila::shared::text::FromUtf8(lila::shared::errors::UnexpectedError), true);
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
        UpdateStatus(lila::shared::text::FromUtf8(lila::shared::errors::ActionInProgress), true);
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
                weakSelf->UpdateStatus(lila::shared::text::FromUtf8(errorMessage), true);
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
