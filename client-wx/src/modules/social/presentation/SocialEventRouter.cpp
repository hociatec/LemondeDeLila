#include "modules/social/presentation/SocialEventRouter.h"

#include <stdexcept>
#include <utility>

#include <wx/event.h>
#include <wx/frame.h>
#include <wx/window.h>

#include "modules/social/presentation/SocialFocusController.h"
#include "modules/social/presentation/SocialNavigationState.h"
#include "modules/social/presentation/SocialView.h"
#include "shared/accessibility/NavigationController.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/logging/Logger.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::social::presentation
{
namespace
{
using Navigator = lila::shared::accessibility::NavigationController;

bool IsSameWindow(wxWindow* left, wxWindow* right)
{
    return left != nullptr && right != nullptr && left == right;
}

wxWindow* CurrentActionMenuContainer(SocialView& view, SocialSection section)
{
    const auto friends = view.FriendsSection();
    const auto incoming = view.IncomingSection();
    const auto outgoing = view.OutgoingSection();
    const auto blocked = view.BlockedSection();
    switch (section)
    {
    case SocialSection::Friends: return friends.actionsMenu;
    case SocialSection::IncomingRequests: return incoming.actionsMenu;
    case SocialSection::OutgoingRequests: return outgoing.actionsMenu;
    case SocialSection::Blocked: return blocked.actionsMenu;
    case SocialSection::Profile: return view.Profile().profileMenu;
    }
    return nullptr;
}
}

void SocialEventRouter::BindRootEvents(
    wxFrame& frame,
    SocialView& view,
    SocialNavigationState& navigationState,
    SocialFocusController& focusController,
    Handlers handlers)
{
    frame.Bind(
        wxEVT_CHAR_HOOK,
        [&view, &navigationState, &focusController, handlers](wxKeyEvent& event)
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
        frame,
        [&view, &navigationState, &focusController, handlers]()
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

    focusController.BindNavigation(frame);

    frame.Bind(
        wxEVT_CLOSE_WINDOW,
        [handlers = std::move(handlers)](wxCloseEvent& event)
        {
            if (handlers.beginClosing)
            {
                handlers.beginClosing();
            }
            if (event.CanVeto())
            {
                event.Veto();
            }
            if (handlers.onExitRequested)
            {
                handlers.onExitRequested();
            }
        });
}
}
