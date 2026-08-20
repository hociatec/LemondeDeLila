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

bool IsExplicitTabNavigationContext(const SocialNavigationState& state) noexcept
{
    return state.currentScreen == Screen::Section &&
           state.currentSection == SocialSection::Profile &&
           state.profileEditorMode != ProfileEditorMode::Menu;
}

wxWindow* ListOrEmpty(lila::shared::ui::controls::VerticalMenu* list, wxWindow* emptyControl)
{
    return list != nullptr && list->GetItemCount() > 0 ? list->GetFirstButton() : emptyControl;
}

Navigator::Scope BuildSectionScope(SocialView& view, const SocialNavigationState& state)
{
    const auto shell = view.Shell();
    const auto friends = view.FriendsSection();
    const auto incoming = view.IncomingSection();
    const auto outgoing = view.OutgoingSection();
    const auto blocked = view.BlockedSection();
    const auto profile = view.Profile();
    Navigator::Scope scope;
    if (state.currentScreen == Screen::Menu)
    {
        scope.Add([shell]() -> wxWindow* { return shell.menu != nullptr ? shell.menu->GetFirstButton() : nullptr; });
        return scope;
    }

    switch (state.currentSection)
    {
    case SocialSection::Friends:
        scope.Add([friends] { return ListOrEmpty(friends.list, friends.emptyControl); });
        if (state.sectionActionMenuActive)
        {
            scope.Add([friends]() -> wxWindow* { return friends.actionsMenu != nullptr ? friends.actionsMenu->GetFirstButton() : nullptr; });
        }
        break;
    case SocialSection::IncomingRequests:
        scope.Add([incoming] { return ListOrEmpty(incoming.list, incoming.emptyControl); });
        if (state.sectionActionMenuActive)
        {
            scope.Add([incoming]() -> wxWindow* { return incoming.actionsMenu != nullptr ? incoming.actionsMenu->GetFirstButton() : nullptr; });
        }
        break;
    case SocialSection::OutgoingRequests:
        scope.Add([outgoing] { return ListOrEmpty(outgoing.list, outgoing.emptyControl); });
        if (state.sectionActionMenuActive)
        {
            scope.Add([outgoing]() -> wxWindow* { return outgoing.actionsMenu != nullptr ? outgoing.actionsMenu->GetFirstButton() : nullptr; });
        }
        break;
    case SocialSection::Blocked:
        scope.Add([blocked] { return ListOrEmpty(blocked.list, blocked.emptyControl); });
        if (state.sectionActionMenuActive)
        {
            scope.Add([blocked]() -> wxWindow* { return blocked.actionsMenu != nullptr ? blocked.actionsMenu->GetFirstButton() : nullptr; });
        }
        break;
    case SocialSection::Profile:
        switch (state.profileEditorMode)
        {
        case ProfileEditorMode::Menu:
            scope.Add([profile]() -> wxWindow*
            {
                if (profile.profileMenu != nullptr && profile.profileMenu->IsShown())
                {
                    return profile.profileMenu->GetFirstButton();
                }

                return profile.profileInfoCtrl;
            })
                 .Add(profile.profileCancelButton);
            break;
        case ProfileEditorMode::Bio:
            scope.Add({profile.profileBioCtrl, profile.profileSaveButton, profile.profileCancelButton});
            break;
        case ProfileEditorMode::VictoryMessage:
            scope.Add({profile.profileVictoryCtrl, profile.profileSaveButton, profile.profileCancelButton});
            break;
        case ProfileEditorMode::DefeatMessage:
            scope.Add({profile.profileDefeatCtrl, profile.profileSaveButton, profile.profileCancelButton});
            break;
        case ProfileEditorMode::Visibility:
            scope.Add({profile.profileVisibilityChoice, profile.profileSaveButton, profile.profileCancelButton});
            break;
        }
        break;
    }
    return scope;
}

wxWindow* CurrentAction(SocialView& view, SocialSection section)
{
    const auto friends = view.FriendsSection();
    const auto incoming = view.IncomingSection();
    const auto outgoing = view.OutgoingSection();
    const auto blocked = view.BlockedSection();
    switch (section)
    {
    case SocialSection::Friends: return friends.actionsMenu != nullptr ? friends.actionsMenu->GetFirstButton() : nullptr;
    case SocialSection::IncomingRequests: return incoming.actionsMenu != nullptr ? incoming.actionsMenu->GetFirstButton() : nullptr;
    case SocialSection::OutgoingRequests: return outgoing.actionsMenu != nullptr ? outgoing.actionsMenu->GetFirstButton() : nullptr;
    case SocialSection::Blocked: return blocked.actionsMenu != nullptr ? blocked.actionsMenu->GetFirstButton() : nullptr;
    case SocialSection::Profile: return nullptr;
    }
    return nullptr;
}

wxWindow* CurrentList(SocialView& view, SocialSection section)
{
    const auto friends = view.FriendsSection();
    const auto incoming = view.IncomingSection();
    const auto outgoing = view.OutgoingSection();
    const auto blocked = view.BlockedSection();
    switch (section)
    {
    case SocialSection::Friends: return friends.list != nullptr ? friends.list->GetFirstButton() : nullptr;
    case SocialSection::IncomingRequests: return incoming.list != nullptr ? incoming.list->GetFirstButton() : nullptr;
    case SocialSection::OutgoingRequests: return outgoing.list != nullptr ? outgoing.list->GetFirstButton() : nullptr;
    case SocialSection::Blocked: return blocked.list != nullptr ? blocked.list->GetFirstButton() : nullptr;
    case SocialSection::Profile: return nullptr;
    }
    return nullptr;
}
}

SocialFocusController::SocialFocusController(
    SocialView& view,
    SocialNavigationState& navigationState,
    SelectionSyncHandler onSelectionAdjusted)
    : view_(view),
      navigationState_(navigationState),
      onSelectionAdjusted_(std::move(onSelectionAdjusted))
{
}

void SocialFocusController::BindNavigation(wxWindow& owner)
{
    Navigator::BindTabNavigation(
        owner,
        [this]() { return BuildSectionScope(view_, navigationState_); },
        [this]() { return IsExplicitTabNavigationContext(navigationState_); });
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
        const auto shell = view_.Shell();
        shell.menu->SetSelectedIndexSilently(navigationState_.lastMenuIndex);
        shell.menu->FocusSelectedItem();
        return;
    }

    const auto focusListOrEmpty = [this](lila::shared::ui::controls::VerticalMenu* list, wxWindow* emptyControl)
    {
        if (list != nullptr && list->GetItemCount() > 0)
        {
            if (list->GetSelectedIndex() >= list->GetItemCount())
            {
                list->SetSelectedIndexSilently(0);
                if (onSelectionAdjusted_) onSelectionAdjusted_();
            }
            list->FocusSelectedItem();
            return;
        }
        static_cast<void>(Navigator::Focus(emptyControl));
    };

    switch (navigationState_.currentSection)
    {
    case SocialSection::Friends:
    case SocialSection::IncomingRequests:
    case SocialSection::OutgoingRequests:
    case SocialSection::Blocked:
        if (navigationState_.sectionActionMenuActive && Navigator::Focus(CurrentSectionActionControl()))
        {
            return;
        }
        switch (navigationState_.currentSection)
        {
        case SocialSection::Friends: { const auto s = view_.FriendsSection(); focusListOrEmpty(s.list, s.emptyControl); return; }
        case SocialSection::IncomingRequests: { const auto s = view_.IncomingSection(); focusListOrEmpty(s.list, s.emptyControl); return; }
        case SocialSection::OutgoingRequests: { const auto s = view_.OutgoingSection(); focusListOrEmpty(s.list, s.emptyControl); return; }
        case SocialSection::Blocked: { const auto s = view_.BlockedSection(); focusListOrEmpty(s.list, s.emptyControl); return; }
        case SocialSection::Profile: break;
        }
        return;
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
