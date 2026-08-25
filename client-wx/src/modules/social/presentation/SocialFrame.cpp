#include "shared/text/presentation/encoding/Encoding.h"
#include "modules/social/presentation/SocialFrame.h"
#include "modules/social/presentation/SocialActionController.h"
#include "modules/social/presentation/SocialLoadController.h"
#include "modules/social/presentation/SocialProfileCoordinator.h"
#include "modules/social/presentation/SocialScreenCoordinator.h"
#include "modules/social/presentation/SocialSectionCoordinator.h"
#include "modules/social/presentation/SocialSectionPresenter.h"
#include "modules/social/presentation/SocialView.h"
#include "shared/ui/application/BackgroundTask.h"

#include <memory>
#include <stdexcept>
#include <utility>

#include <wx/button.h>
#include <wx/choice.h>
#include <wx/msgdlg.h>
#include <wx/sizer.h>
#include <wx/panel.h>
#include <wx/textctrl.h>
#include <wx/weakref.h>

#include "modules/social/application/SocialService.h"
#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/accessibility/application/FocusManager.h"
#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/logging/application/Logger.h"
#include "shared/text/presentation/catalog/UiTexts.h"
#include "shared/config/domain/AppConfig.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace
{
constexpr int WindowWidth = 1180;
constexpr int WindowHeight = 780;
}
namespace lila::modules::social::presentation
{
SocialFrame::~SocialFrame() = default;

SocialFrame::SocialFrame(
    wxWindow* parent,
    lila::modules::social::application::SocialService& socialService,
    OpenMessagingRequestedHandler onOpenMessagingRequested,
    OpenStoryBookRequestedHandler onOpenStoryBookRequested,
    CloseRequestedHandler onCloseRequested,
    ExitRequestedHandler onExitRequested,
    std::size_t initialSelectedMenuIndex)
    : lila::shared::accessibility::NonFocusablePanel(
          parent,
          0),
      onOpenMessagingRequested_(std::move(onOpenMessagingRequested)),
      onOpenStoryBookRequested_(std::move(onOpenStoryBookRequested)),
      onCloseRequested_(std::move(onCloseRequested)),
      onExitRequested_(std::move(onExitRequested)),
      navigationState_(initialSelectedMenuIndex)
{
    SetMinSize(wxSize(WindowWidth, WindowHeight));
    view_ = new SocialView(this);
    auto* frameSizer = new wxBoxSizer(wxVERTICAL);
    frameSizer->Add(view_, 1, wxEXPAND);
    SetSizer(frameSizer);
    view_->ApplyTheme();
    loadController_ = std::make_unique<SocialLoadController>(socialService);
    sectionPresenter_ = std::make_unique<SocialSectionPresenter>(
        *this, *view_, dataStore_, navigationState_, selectionMemory_);
    sectionCoordinator_ = std::make_unique<SocialSectionCoordinator>(
        *loadController_,
        dataStore_,
        navigationState_,
        *sectionPresenter_,
        *view_,
        SocialSectionCoordinator::Callbacks{
            [this](const wxString& busyMessage, const std::function<void()>& worker, const std::function<void()>& onSuccess, bool announceBusy)
            {
                RunBackgroundTask(busyMessage, worker, onSuccess, announceBusy);
            },
            [this](const wxString& message, bool isError, bool announce)
            {
                UpdateStatus(message, isError, announce);
            },
            [this]()
            {
                ArmInitialListActivationSuppression();
                ScheduleFocusCurrentScreen();
            }});
    screenCoordinator_ = std::make_unique<SocialScreenCoordinator>(
        navigationState_,
        *sectionCoordinator_,
        *sectionPresenter_,
        *view_,
        SocialScreenCoordinator::Callbacks{
            [this](std::size_t selectedMenuIndex)
            {
                if (onOpenMessagingRequested_)
                {
                    onOpenMessagingRequested_(selectedMenuIndex);
                }
            },
            [this]()
            {
                if (onCloseRequested_)
                {
                    onCloseRequested_();
                }
            },
            [this]()
            {
                SyncPanels();
            },
            [this]()
            {
                ScheduleFocusCurrentScreen();
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
    profileCoordinator_ = std::make_unique<SocialProfileCoordinator>(
        navigationState_,
        dataStore_,
        *sectionPresenter_,
        *view_,
        *actionController_,
        SocialProfileCoordinator::Callbacks{
            [this](const wxString& message, bool isError)
            {
                UpdateStatus(message, isError);
            },
            [this](const wxString& message)
            {
                ShowActionFeedback(message);
            },
            [this]()
            {
                ScheduleFocusCurrentScreen();
            },
            [this](int userId, std::string username)
            {
                if (onOpenStoryBookRequested_)
                {
                    onOpenStoryBookRequested_(userId, std::move(username));
                }
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

    SyncPanels();
    UpdateStatus(lila::shared::text::FromUtf8(lila::shared::text::ui::KeyboardNavigationHint), false, false);
}
}
