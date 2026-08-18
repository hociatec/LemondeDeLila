#include "modules/social/presentation/SocialFocusController.h"

#include <utility>

#include <wx/event.h>
#include <wx/window.h>

#include "modules/social/presentation/SocialDataStore.h"
#include "modules/social/presentation/SocialView.h"
#include "shared/accessibility/NavigationController.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::social::presentation
{
namespace
{
using Navigator = lila::shared::accessibility::NavigationController;
using ProfileEditorMode = SocialNavigationState::ProfileEditorMode;
using Screen = SocialNavigationState::Screen;

wxWindow* ListOrEmpty(lila::shared::ui::controls::VerticalMenu* list, wxWindow* emptyControl)
{
    return list != nullptr && list->GetItemCount() > 0 ? list->GetFirstButton() : emptyControl;
}

Navigator::Scope BuildSectionScope(SocialView& view, const SocialNavigationState& state)
{
    Navigator::Scope scope;
    if (state.currentScreen == Screen::Menu)
    {
        scope.Add([&view]() -> wxWindow* { return view.menu != nullptr ? view.menu->GetFirstButton() : nullptr; });
        return scope;
    }

    switch (state.currentSection)
    {
    case SocialSection::Friends:
        scope.Add([&view] { return ListOrEmpty(view.friendsList, view.emptyFriendsCtrl); })
             .Add([&view]() -> wxWindow* { return view.friendsActionsMenu != nullptr ? view.friendsActionsMenu->GetFirstButton() : nullptr; });
        break;
    case SocialSection::IncomingRequests:
        scope.Add([&view] { return ListOrEmpty(view.incomingRequestsList, view.emptyIncomingRequestsCtrl); })
             .Add([&view]() -> wxWindow* { return view.incomingActionsMenu != nullptr ? view.incomingActionsMenu->GetFirstButton() : nullptr; });
        break;
    case SocialSection::OutgoingRequests:
        scope.Add([&view] { return ListOrEmpty(view.outgoingRequestsList, view.emptyOutgoingRequestsCtrl); })
             .Add([&view]() -> wxWindow* { return view.outgoingActionsMenu != nullptr ? view.outgoingActionsMenu->GetFirstButton() : nullptr; });
        break;
    case SocialSection::Blocked:
        scope.Add([&view] { return ListOrEmpty(view.blockedUsersList, view.emptyBlockedUsersCtrl); })
             .Add([&view]() -> wxWindow* { return view.blockedActionsMenu != nullptr ? view.blockedActionsMenu->GetFirstButton() : nullptr; });
        break;
    case SocialSection::Profile:
        switch (state.profileEditorMode)
        {
        case ProfileEditorMode::Menu:
            scope.Add([&view]() -> wxWindow* { return view.profileMenu != nullptr ? view.profileMenu->GetFirstButton() : view.profileInfoCtrl; })
                 .Add(view.profileCancelButton);
            break;
        case ProfileEditorMode::Bio:
            scope.Add({view.profileBioCtrl, view.profileSaveButton, view.profileCancelButton});
            break;
        case ProfileEditorMode::VictoryMessage:
            scope.Add({view.profileVictoryCtrl, view.profileSaveButton, view.profileCancelButton});
            break;
        case ProfileEditorMode::DefeatMessage:
            scope.Add({view.profileDefeatCtrl, view.profileSaveButton, view.profileCancelButton});
            break;
        case ProfileEditorMode::Visibility:
            scope.Add({view.profileVisibilityChoice, view.profileSaveButton, view.profileCancelButton});
            break;
        }
        break;
    }
    return scope;
}

wxWindow* CurrentAction(SocialView& view, SocialSection section)
{
    switch (section)
    {
    case SocialSection::Friends: return view.friendsActionsMenu != nullptr ? view.friendsActionsMenu->GetFirstButton() : nullptr;
    case SocialSection::IncomingRequests: return view.incomingActionsMenu != nullptr ? view.incomingActionsMenu->GetFirstButton() : nullptr;
    case SocialSection::OutgoingRequests: return view.outgoingActionsMenu != nullptr ? view.outgoingActionsMenu->GetFirstButton() : nullptr;
    case SocialSection::Blocked: return view.blockedActionsMenu != nullptr ? view.blockedActionsMenu->GetFirstButton() : nullptr;
    case SocialSection::Profile: return nullptr;
    }
    return nullptr;
}

wxWindow* CurrentList(SocialView& view, SocialSection section)
{
    switch (section)
    {
    case SocialSection::Friends: return view.friendsList != nullptr ? view.friendsList->GetFirstButton() : nullptr;
    case SocialSection::IncomingRequests: return view.incomingRequestsList != nullptr ? view.incomingRequestsList->GetFirstButton() : nullptr;
    case SocialSection::OutgoingRequests: return view.outgoingRequestsList != nullptr ? view.outgoingRequestsList->GetFirstButton() : nullptr;
    case SocialSection::Blocked: return view.blockedUsersList != nullptr ? view.blockedUsersList->GetFirstButton() : nullptr;
    case SocialSection::Profile: return nullptr;
    }
    return nullptr;
}
}

SocialFocusController::SocialFocusController(
    wxWindow& owner,
    SocialView& view,
    SocialNavigationState& navigationState,
    const SocialDataStore& dataStore,
    SelectionSyncHandler onSelectionAdjusted)
    : owner_(owner),
      view_(view),
      navigationState_(navigationState),
      dataStore_(dataStore),
      onSelectionAdjusted_(std::move(onSelectionAdjusted))
{
}

void SocialFocusController::BindNavigation(wxWindow& owner)
{
    Navigator::BindTabNavigation(
        owner,
        [this]() { return BuildSectionScope(view_, navigationState_); },
        [this]()
        {
            return navigationState_.currentSection == SocialSection::Profile &&
                   navigationState_.profileEditorMode != ProfileEditorMode::Menu;
        });

    Navigator::BindBoundaryTabNavigation(
        owner,
        [this]() { return BuildSectionScope(view_, navigationState_); },
        &owner_,
        [this]()
        {
            if (navigationState_.currentScreen == Screen::Menu ||
                navigationState_.currentSection == SocialSection::Friends ||
                navigationState_.currentSection == SocialSection::Blocked ||
                (navigationState_.currentSection == SocialSection::Profile && navigationState_.profileEditorMode == ProfileEditorMode::Menu))
            {
                return false;
            }
            return navigationState_.currentSection != SocialSection::Profile ||
                (dataStore_.Profile().has_value() && dataStore_.Profile()->isOwner);
        });
}

void SocialFocusController::FocusCurrentSectionActionMenu()
{
    if (Navigator::Focus(CurrentSectionActionControl()))
    {
        return;
    }
    static_cast<void>(Navigator::Focus(CurrentSectionList()));
}

void SocialFocusController::FocusCurrentScreen()
{
    if (navigationState_.currentScreen == Screen::Menu)
    {
        view_.menu->SetSelectedIndex(navigationState_.lastMenuIndex);
        view_.menu->FocusSelectedItem();
        return;
    }

    const auto focusListOrEmpty = [this](lila::shared::ui::controls::VerticalMenu* list, wxWindow* emptyControl)
    {
        if (list != nullptr && list->GetItemCount() > 0)
        {
            if (list->GetSelectedIndex() >= list->GetItemCount())
            {
                list->SetSelectedIndex(0);
                if (onSelectionAdjusted_) onSelectionAdjusted_();
            }
            list->FocusSelectedItem();
            return;
        }
        static_cast<void>(Navigator::Focus(emptyControl));
    };

    switch (navigationState_.currentSection)
    {
    case SocialSection::Friends: focusListOrEmpty(view_.friendsList, view_.emptyFriendsCtrl); return;
    case SocialSection::IncomingRequests: focusListOrEmpty(view_.incomingRequestsList, view_.emptyIncomingRequestsCtrl); return;
    case SocialSection::OutgoingRequests: focusListOrEmpty(view_.outgoingRequestsList, view_.emptyOutgoingRequestsCtrl); return;
    case SocialSection::Blocked: focusListOrEmpty(view_.blockedUsersList, view_.emptyBlockedUsersCtrl); return;
    case SocialSection::Profile:
        static_cast<void>(Navigator::FocusFirst(BuildSectionScope(view_, navigationState_)));
        return;
    }
}

wxWindow* SocialFocusController::CurrentSectionActionControl() const
{
    return CurrentAction(view_, navigationState_.currentSection);
}

wxWindow* SocialFocusController::CurrentSectionList() const
{
    return CurrentList(view_, navigationState_.currentSection);
}
}
