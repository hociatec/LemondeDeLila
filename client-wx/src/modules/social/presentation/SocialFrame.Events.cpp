#include "shared/text/Encoding.h"
#include "modules/social/presentation/SocialFrame.h"
#include "modules/social/presentation/SocialActionController.h"
#include "modules/social/presentation/SocialFocusController.h"
#include "modules/social/presentation/SocialSectionPresenter.h"
#include "modules/social/presentation/SocialView.h"
#include "modules/social/presentation/SocialEventRouter.h"
#include "modules/social/presentation/SocialEventRouter.inl"
#include "shared/accessibility/FocusNavigation.h"

#include <array>
#include <stdexcept>

#include <wx/button.h>
#include <wx/choice.h>
#include <wx/defs.h>
#include <wx/event.h>
#include <wx/textctrl.h>

#include "modules/social/application/SocialService.h"
#include "shared/ui/controls/VerticalMenu.h"
#include "shared/ui/navigation/MenuBlueprint.h"
#include "shared/errors/ErrorMessages.h"

namespace lila::modules::social::presentation
{
void SocialFrame::BindEvents()
{
    BindMenuEvents();
    BindFriendsEvents();
    BindIncomingRequestsEvents();
    BindOutgoingRequestsEvents();
    BindBlockedUsersEvents();
    BindProfileEvents();

    SocialEventRouter::BindRootEvents(
        *this,
        *view_,
        navigationState_,
        *focusController_,
        SocialEventRouter::Handlers{
            [this]() { HandleEscape(); },
            [this]() { ActivateSelectedMenu(); },
            [this]() { ActivateProfileEditorSelection(); },
            [this](const std::string& message) { UpdateStatus(lila::shared::text::FromUtf8(message), true); },
            [this]() { isClosing_ = true; },
            [this]()
            {
                if (onExitRequested_)
                {
                    onExitRequested_();
                }
            }});
}

void SocialFrame::BindMenuEvents()
{
    lila::shared::ui::navigation::BindMenuHandlers(
        *view_->menu,
        [this](std::size_t index)
        {
            navigationState_.lastMenuIndex = index;
        },
        [this](std::size_t index)
        {
            RunUiAction(
                [this, index]()
                {
                    ActivateMenuIndex(index);
                });
        });

    if (view_->profileMenu != nullptr)
    {
        view_->profileMenu->SetActivatedHandler(
            [this](std::size_t)
            {
                RunUiAction(
                    [this]()
                    {
                        ActivateProfileEditorSelection();
                    });
                });
    }
}

void SocialFrame::BindFriendsEvents()
{
    BindSectionSelectionRefresh(*view_->friendsList);
    if (view_->friendsActionsMenu != nullptr)
    {
        view_->friendsActionsMenu->SetActivatedHandler(
            [this](std::size_t actionIndex)
            {
                RunUiAction(
                    [this, actionIndex]()
                    {
                        const auto userId = sectionPresenter_->GetSelectedUserId();
                        actionController_->ActivateFriend(
                        actionIndex,
                        userId,
                        userId.has_value() && dataStore_.IsBlocked(*userId));
                    });
            });
    }

    view_->friendsList->SetActivatedHandler(
        [this](std::size_t)
        {
            RunUiAction(
                [this]()
                {
                    focusController_->FocusCurrentSectionActionMenu();
                });
        });
}

void SocialFrame::BindIncomingRequestsEvents()
{
    BindSectionSelectionRefresh(*view_->incomingRequestsList);
    if (view_->incomingActionsMenu != nullptr)
    {
        view_->incomingActionsMenu->SetActivatedHandler(
            [this](std::size_t actionIndex)
            {
                RunUiAction(
                    [this, actionIndex]()
                    {
                        const auto userId = sectionPresenter_->GetSelectedUserId();
                        actionController_->ActivateIncomingRequest(
                        actionIndex,
                        userId,
                        userId.has_value() && dataStore_.IsBlocked(*userId));
                    });
            });
    }

    view_->incomingRequestsList->SetActivatedHandler(
        [this](std::size_t)
        {
            RunUiAction(
                [this]()
                {
                    focusController_->FocusCurrentSectionActionMenu();
                });
        });
}

void SocialFrame::BindOutgoingRequestsEvents()
{
    BindSectionSelectionRefresh(*view_->outgoingRequestsList);
    if (view_->outgoingActionsMenu != nullptr)
    {
        view_->outgoingActionsMenu->SetActivatedHandler(
            [this](std::size_t actionIndex)
            {
                RunUiAction(
                    [this, actionIndex]()
                    {
                        const auto userId = sectionPresenter_->GetSelectedUserId();
                        actionController_->ActivateOutgoingRequest(
                        actionIndex,
                        userId,
                        userId.has_value() && dataStore_.IsBlocked(*userId));
                    });
            });
    }

    view_->outgoingRequestsList->SetActivatedHandler(
        [this](std::size_t)
        {
            RunUiAction(
                [this]()
                {
                    focusController_->FocusCurrentSectionActionMenu();
                });
        });
}

void SocialFrame::BindBlockedUsersEvents()
{
    BindSectionSelectionRefresh(*view_->blockedUsersList);
    if (view_->blockedActionsMenu != nullptr)
    {
        view_->blockedActionsMenu->SetActivatedHandler(
            [this](std::size_t actionIndex)
            {
                RunUiAction(
                    [this, actionIndex]()
                    {
                        actionController_->ActivateBlockedUser(actionIndex, sectionPresenter_->GetSelectedUserId());
                    });
            });
    }

    view_->blockedUsersList->SetActivatedHandler(
        [this](std::size_t)
        {
            RunUiAction(
                [this]()
                {
                    focusController_->FocusCurrentSectionActionMenu();
                });
        });
}

void SocialFrame::BindProfileEvents()
{
    view_->profileSaveButton->Bind(
        wxEVT_BUTTON,
        [this](wxCommandEvent&)
        {
            RunUiAction([this]() { SaveProfile(); });
        });
    view_->profileCancelButton->Bind(
        wxEVT_BUTTON,
        [this](wxCommandEvent&)
        {
            if (navigationState_.profileEditorMode == ProfileEditorMode::Menu)
            {
                HandleEscape();
                return;
            }

            ExitProfileEditMode();
        });

}

void SocialFrame::BindSectionSelectionRefresh(lila::shared::ui::controls::VerticalMenu& list)
{
    list.SetSelectionChangedHandler(
        [this](std::size_t)
        {
            RunUiAction(
                [this]()
                {
                    sectionPresenter_->SyncSelectionState();
                });
        });
}

void SocialFrame::SetScreen(Screen screen)
{
    if (screen == Screen::Menu)
    {
        navigationState_.EnterMenu();
    }
    else
    {
        navigationState_.currentScreen = screen;
    }
    if (screen == Screen::Menu && view_->menu != nullptr)
    {
        view_->menu->SetSelectedIndex(navigationState_.lastMenuIndex);
    }

    focusController_->FocusCurrentScreen();
}

void SocialFrame::ActivateSelectedMenu()
{
    ActivateMenuIndex(view_->menu->GetSelectedIndex());
}

void SocialFrame::ActivateMenuIndex(std::size_t index)
{
    navigationState_.lastMenuIndex = index;
    if (index == 0)
    {
        if (onOpenMessagingRequested_)
        {
            onOpenMessagingRequested_(navigationState_.lastMenuIndex);
        }
        return;
    }

    const auto section = SocialPresentationModel::MenuIndexToSection(index);
    if (!section.has_value())
    {
        return;
    }

    if (*section == SocialSection::Profile)
    {
        navigationState_.returnSectionFromProfile.reset();
        LoadProfile(std::nullopt);
    }

    SetSection(*section);
}

void SocialFrame::ActivateProfileEditorSelection()
{
    if (!dataStore_.Profile().has_value() || !dataStore_.Profile()->isOwner)
    {
        return;
    }

    switch (view_->profileMenu->GetSelectedIndex())
    {
    case 0:
        StartProfileEdit(ProfileEditorMode::Bio);
        return;
    case 1:
        StartProfileEdit(ProfileEditorMode::VictoryMessage);
        return;
    case 2:
        StartProfileEdit(ProfileEditorMode::DefeatMessage);
        return;
    case 3:
        StartProfileEdit(ProfileEditorMode::Visibility);
        return;
    default:
        return;
    }
}

void SocialFrame::HandleEscape()
{
    try
    {
        if (navigationState_.currentScreen == Screen::Section)
        {
            if (navigationState_.currentSection == SocialSection::Profile && TryExitProfile())
            {
                return;
            }

            SetScreen(Screen::Menu);
            return;
        }

        if (onCloseRequested_)
        {
            onCloseRequested_();
        }
    }
    catch (const std::exception& error)
    {
        UpdateStatus(lila::shared::text::FromUtf8(error.what()), true);
    }
}
}

#include "modules/social/presentation/SocialFocusController.inl"
