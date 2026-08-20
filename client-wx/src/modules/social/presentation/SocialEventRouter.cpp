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
bool IsSameWindow(wxWindow* left, wxWindow* right)
{
    return left != nullptr && right != nullptr && left == right;
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
                using Screen = SocialNavigationState::Screen;
                using ProfileEditorMode = SocialNavigationState::ProfileEditorMode;

                if (key == WXK_ESCAPE)
                {
                    const wxWindow* focused = wxWindow::FindFocus();
                    if (navigationState.currentSection != SocialSection::Profile || navigationState.profileEditorMode != ProfileEditorMode::Menu)
                    {
                        wxWindow* currentActionControl = focusController.CurrentSectionActionControl();
                        if (focused != nullptr && focused == currentActionControl)
                        {
                            wxWindow* sectionList = focusController.CurrentSectionList();
                            if (lila::shared::accessibility::NavigationController::Focus(sectionList))
                            {
                                return;
                            }
                        }
                    }

                    if (handlers.handleEscape)
                    {
                        handlers.handleEscape();
                    }
                    return;
                }

                if ((key == WXK_RETURN || key == WXK_NUMPAD_ENTER) && navigationState.currentScreen == Screen::Section)
                {
                    wxWindow* focused = wxWindow::FindFocus();
                    if (navigationState.currentSection == SocialSection::Profile && navigationState.profileEditorMode == ProfileEditorMode::Menu &&
                        focused != nullptr && focused->GetParent() == view.profileMenu)
                    {
                        if (handlers.activateProfileEditorSelection)
                        {
                            handlers.activateProfileEditorSelection();
                        }
                        return;
                    }

                    wxWindow* firstButton = nullptr;
                    switch (navigationState.currentSection)
                    {
                    case SocialSection::Friends:
                        if (view.friendsList != nullptr) firstButton = view.friendsList->GetFirstButton();
                        break;
                    case SocialSection::IncomingRequests:
                        if (view.incomingRequestsList != nullptr) firstButton = view.incomingRequestsList->GetFirstButton();
                        break;
                    case SocialSection::OutgoingRequests:
                        if (view.outgoingRequestsList != nullptr) firstButton = view.outgoingRequestsList->GetFirstButton();
                        break;
                    case SocialSection::Blocked:
                        if (view.blockedUsersList != nullptr) firstButton = view.blockedUsersList->GetFirstButton();
                        break;
                    case SocialSection::Profile:
                        break;
                    }

                    if (IsSameWindow(focused, firstButton))
                    {
                        focusController.FocusCurrentSectionActionMenu();
                        return;
                    }
                }

                if ((key == WXK_RETURN || key == WXK_NUMPAD_ENTER) && navigationState.currentScreen == Screen::Menu)
                {
                    if (handlers.activateSelectedMenu)
                    {
                        handlers.activateSelectedMenu();
                    }
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
