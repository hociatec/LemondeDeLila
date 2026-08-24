#include "shared/text/Encoding.h"
#include "modules/social/presentation/SocialFrame.h"
#include "modules/social/presentation/SocialProfileCoordinator.h"
#include "modules/social/presentation/SocialScreenCoordinator.h"
#include "modules/social/presentation/SocialView.h"
#include "modules/social/presentation/SocialEventRouter.h"
#include "shared/accessibility/NavigationController.h"

namespace lila::modules::social::presentation
{
void SocialFrame::BindEvents()
{
    BindMenuEvents();
    BindSectionEvents(SocialSection::Friends);
    BindSectionEvents(SocialSection::IncomingRequests);
    BindSectionEvents(SocialSection::OutgoingRequests);
    BindSectionEvents(SocialSection::Blocked);
    BindProfileEvents();

    lila::shared::accessibility::NavigationController::BindTabNavigation(
        *this,
        [this]() { return BuildFocusScope(); },
        [this]() { return IsExplicitTabNavigationContext(); });

    SocialEventRouter::BindRootEvents(
        *this,
        *view_,
        navigationState_,
        SocialEventRouter::Handlers{
            [this]()
            {
                if (screenCoordinator_ != nullptr)
                {
                    screenCoordinator_->HandleEscape();
                }
            },
            [this]()
            {
                if (screenCoordinator_ != nullptr)
                {
                    screenCoordinator_->CloseCurrentSectionActionMenu();
                }
            },
            [this]()
            {
                if (profileCoordinator_ != nullptr)
                {
                    profileCoordinator_->ActivateSelectedAction();
                }
            },
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
}

