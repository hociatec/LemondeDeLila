#include "shared/text/Encoding.h"
#include "modules/social/presentation/SocialFrame.h"
#include "modules/social/presentation/SocialView.h"
#include "modules/social/presentation/SocialEventRouter.h"
#include "modules/social/presentation/SocialFocusController.h"

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
            [this]() { CloseCurrentSectionActionMenu(); },
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
}

