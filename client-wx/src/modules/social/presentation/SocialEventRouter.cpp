#include "modules/social/presentation/SocialEventRouter.h"

#include <stdexcept>
#include <utility>

#include <wx/event.h>
#include <wx/window.h>

#include "modules/social/presentation/SocialNavigationState.h"
#include "shared/accessibility/application/NavigationController.h"
#include "shared/errors/catalog/CoreErrorMessages.h"
#include "shared/logging/application/Logger.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::social::presentation
{
namespace
{
using Navigator = lila::shared::accessibility::NavigationController;
}

void SocialEventRouter::BindRootEvents(
    wxWindow& owner,
    SocialNavigationState& navigationState,
    Handlers handlers)
{
    owner.Bind(
        wxEVT_CHAR_HOOK,
        [&navigationState, handlers](wxKeyEvent& event)
        {
            try
            {
                const int key = event.GetKeyCode();
                static_cast<void>(navigationState);
                if (key == WXK_RETURN || key == WXK_NUMPAD_ENTER)
                {
                    event.Skip();
                    return;
                }
            }
            catch (const std::exception& error)
            {
                lila::shared::logging::LogError("Social", error.what());
                if (handlers.reportError)
                {
                    handlers.reportError(lila::shared::errors::UnexpectedError);
                }
                return;
            }

            event.Skip();
        });

    Navigator::BindEscapeNavigation(
        owner,
        [&navigationState, handlers]()
        {
            if (navigationState.currentScreen == SocialNavigationState::Screen::Section &&
                navigationState.currentSection != SocialSection::Profile &&
                navigationState.sectionActionMenuActive)
            {
                if (handlers.closeSectionActionMenu)
                {
                    handlers.closeSectionActionMenu();
                    return true;
                }
            }

            if (handlers.handleEscape)
            {
                handlers.handleEscape();
                return true;
            }
            return false;
        });
}
}
