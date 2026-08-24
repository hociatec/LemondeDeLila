#include "shared/text/Encoding.h"
#include "modules/social/presentation/SocialFrame.h"
#include "modules/social/presentation/SocialActionController.h"
#include "modules/social/presentation/SocialActionId.h"
#include "modules/social/presentation/SocialProfileCoordinator.h"
#include "modules/social/presentation/SocialScreenCoordinator.h"
#include "modules/social/presentation/SocialSectionPresenter.h"
#include "modules/social/presentation/SocialView.h"
#include "shared/ui/controls/VerticalMenu.h"
#include "shared/ui/navigation/MenuBlueprint.h"

#include <wx/button.h>
#include <wx/defs.h>
#include <wx/event.h>

namespace lila::modules::social::presentation
{
namespace
{
wxString BuildMenuSelectionStatus(std::size_t index)
{
    const char* label = lila::shared::text::ui::SocialNavigationMenuAccessible.data();
    switch (index)
    {
    case 0: label = lila::shared::text::ui::SocialMenuMessaging.data(); break;
    case 1: label = lila::shared::text::ui::SocialMenuFriends.data(); break;
    case 2: label = lila::shared::text::ui::SocialMenuIncomingRequests.data(); break;
    case 3: label = lila::shared::text::ui::SocialMenuOutgoingRequests.data(); break;
    case 4: label = lila::shared::text::ui::SocialMenuBlocked.data(); break;
    case 5: label = lila::shared::text::ui::SocialMenuProfile.data(); break;
    default: break;
    }

    return lila::shared::text::FromUtf8(label) + wxString(L". Entrée pour ouvrir.");
}
}

void SocialFrame::BindMenuEvents()
{
    lila::shared::ui::navigation::BindMenuHandlers(
        *view_->menu,
        [this](std::size_t index)
        {
            navigationState_.lastMenuIndex = index;
            UpdateStatus(BuildMenuSelectionStatus(index), false, false);
        },
        [this](std::size_t index)
        {
            RunUiAction(
                [this, index]()
                {
                    if (screenCoordinator_ != nullptr)
                    {
                        screenCoordinator_->ActivateMenuIndex(index);
                    }
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
                        if (profileCoordinator_ != nullptr)
                        {
                            profileCoordinator_->ActivateSelectedAction();
                        }
                    });
            });
    }
}

void SocialFrame::HandleSectionAction(SocialSection section, std::string_view actionId)
{
    const auto parsedAction = ParseSocialActionId(actionId);
    if (!parsedAction.has_value())
    {
        return;
    }

    const auto userId = sectionPresenter_->GetSelectedUserId();
    const bool isBlocked = userId.has_value() && dataStore_.IsBlocked(*userId);
    actionController_->ActivateSectionAction(section, *parsedAction, userId, isBlocked);
}

void SocialFrame::BindSectionEvents(SocialSection section)
{
    const auto controls = view_->SectionFor(section);
    if (controls.list == nullptr)
    {
        return;
    }

    controls.list->SetSelectionChangedHandler(
        [this](std::size_t)
        {
            RunUiAction(
                [this]()
                {
                    sectionPresenter_->SyncSelectionState();
                });
        });
    controls.list->SetActivatedHandler(
        [this](std::size_t)
        {
            RunUiAction(
                [this]()
                {
                    if (ConsumePendingListActivationSuppression())
                    {
                        return;
                    }
                    if (screenCoordinator_ != nullptr)
                    {
                        screenCoordinator_->OpenCurrentSectionActionMenu();
                    }
                });
        });

    if (controls.actionsMenu != nullptr)
    {
        controls.actionsMenu->SetActivatedHandler(
            [this, section, actionsMenu = controls.actionsMenu](std::size_t actionIndex)
            {
                RunUiAction(
                    [this, section, actionsMenu, actionIndex]()
                    {
                        HandleSectionAction(section, actionsMenu->GetItemId(actionIndex));
                    });
            });
    }
}

void SocialFrame::BindProfileEvents()
{
    view_->profileSaveButton->Bind(
        wxEVT_BUTTON,
        [this](wxCommandEvent&)
        {
            RunUiAction(
                [this]()
                {
                    if (profileCoordinator_ != nullptr)
                    {
                        profileCoordinator_->SaveProfile();
                    }
                });
        });
    view_->profileCancelButton->Bind(
        wxEVT_BUTTON,
        [this](wxCommandEvent&)
        {
            if (screenCoordinator_ != nullptr)
            {
                screenCoordinator_->HandleEscape();
            }
        });
}
}
