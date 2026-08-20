#include "shared/text/Encoding.h"
#include "modules/social/presentation/SocialFrame.h"
#include "modules/social/presentation/SocialActionController.h"
#include "modules/social/presentation/SocialFocusController.h"
#include "modules/social/presentation/SocialSectionPresenter.h"
#include "modules/social/presentation/SocialView.h"
#include "shared/ui/controls/VerticalMenu.h"
#include "shared/ui/navigation/MenuBlueprint.h"

#include <wx/button.h>
#include <wx/defs.h>
#include <wx/event.h>

namespace lila::modules::social::presentation
{
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
}
