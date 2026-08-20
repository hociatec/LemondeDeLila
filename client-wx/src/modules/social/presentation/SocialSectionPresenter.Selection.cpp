#include "shared/text/Encoding.h"
#include "modules/social/presentation/SocialSectionPresenter.h"

#include <array>
#include <span>

#include <wx/button.h>
#include <wx/panel.h>

#include "modules/social/presentation/SocialDataStore.h"
#include "modules/social/presentation/SocialNavigationState.h"
#include "modules/social/presentation/SocialView.h"
#include "shared/text/UiTexts.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::social::presentation
{
void SocialSectionPresenter::SyncSectionActionVisibility()
{
    const bool showFriendsActions =
        navigationState_.currentSection == SocialSection::Friends &&
        navigationState_.sectionActionMenuActive &&
        view_.friendsList->GetItemCount() > 0;
    const bool showIncomingActions =
        navigationState_.currentSection == SocialSection::IncomingRequests &&
        navigationState_.sectionActionMenuActive &&
        view_.incomingRequestsList->GetItemCount() > 0;
    const bool showOutgoingActions =
        navigationState_.currentSection == SocialSection::OutgoingRequests &&
        navigationState_.sectionActionMenuActive &&
        view_.outgoingRequestsList->GetItemCount() > 0;
    const bool showBlockedActions =
        navigationState_.currentSection == SocialSection::Blocked &&
        navigationState_.sectionActionMenuActive &&
        view_.blockedUsersList->GetItemCount() > 0;

    if (view_.friendsActionsMenu != nullptr)
    {
        view_.friendsActionsMenu->Show(showFriendsActions);
    }
    if (view_.incomingActionsMenu != nullptr)
    {
        view_.incomingActionsMenu->Show(showIncomingActions);
    }
    if (view_.outgoingActionsMenu != nullptr)
    {
        view_.outgoingActionsMenu->Show(showOutgoingActions);
    }
    if (view_.blockedActionsMenu != nullptr)
    {
        view_.blockedActionsMenu->Show(showBlockedActions);
    }
}

void SocialSectionPresenter::SyncSelectionState()
{
    const auto& friends = dataStore_.Friends();
    const auto& incoming = dataStore_.IncomingRequests();
    const auto& outgoing = dataStore_.OutgoingRequests();

    const bool hasFriends = view_.friendsList->GetItemCount() > 0;
    const bool hasIncoming = view_.incomingRequestsList->GetItemCount() > 0;
    const bool hasOutgoing = view_.outgoingRequestsList->GetItemCount() > 0;
    const bool hasBlocked = view_.blockedUsersList->GetItemCount() > 0;
    const std::size_t friendSelection = view_.friendsList->GetSelectedIndex();
    const std::size_t incomingSelection = view_.incomingRequestsList->GetSelectedIndex();
    const std::size_t outgoingSelection = view_.outgoingRequestsList->GetSelectedIndex();

    view_.friendsList->Show(hasFriends);
    view_.emptyFriendsCtrl->Show(!hasFriends);
    view_.incomingRequestsList->Show(hasIncoming);
    view_.emptyIncomingRequestsCtrl->Show(!hasIncoming);
    view_.outgoingRequestsList->Show(hasOutgoing);
    view_.emptyOutgoingRequestsCtrl->Show(!hasOutgoing);
    view_.blockedUsersList->Show(hasBlocked);
    view_.emptyBlockedUsersCtrl->Show(!hasBlocked);
    SyncSectionActionVisibility();

    const bool canActOnFriends = hasFriends && friendSelection < friends.size();
    if (view_.friendsActionsMenu != nullptr && view_.friendsActionsMenu->GetFirstButton() != nullptr)
    {
        const bool blockedFriend = canActOnFriends && dataStore_.IsBlocked(friends[friendSelection].id);
        const std::array<lila::shared::ui::controls::VerticalMenuItem, 3> items = {{
            {"view-profile", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionView)},
            {"remove-friend", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionRemoveFriend)},
            {"block-friend", blockedFriend ? lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionUnblock)
                                           : lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionBlock)},
        }};
        const auto selected = view_.friendsActionsMenu->GetSelectedIndex();
        view_.friendsActionsMenu->SetItems(std::span<const lila::shared::ui::controls::VerticalMenuItem>{items.data(), items.size()});
        if (selected < view_.friendsActionsMenu->GetItemCount())
        {
            view_.friendsActionsMenu->SetSelectedIndexSilently(selected);
        }
    }

    const bool canActOnIncoming = hasIncoming && incomingSelection < incoming.size();
    if (view_.incomingActionsMenu != nullptr && view_.incomingActionsMenu->GetFirstButton() != nullptr)
    {
        const bool blockedSender = canActOnIncoming && dataStore_.IsBlocked(incoming[incomingSelection].requester.id);
        const std::array<lila::shared::ui::controls::VerticalMenuItem, 4> items = {{
            {"accept-request", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionAccept)},
            {"reject-request", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionReject)},
            {"view-profile", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionView)},
            {"block-user", blockedSender ? lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionUnblock)
                                         : lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionBlock)},
        }};
        const auto selected = view_.incomingActionsMenu->GetSelectedIndex();
        view_.incomingActionsMenu->SetItems(std::span<const lila::shared::ui::controls::VerticalMenuItem>{items.data(), items.size()});
        if (selected < view_.incomingActionsMenu->GetItemCount())
        {
            view_.incomingActionsMenu->SetSelectedIndexSilently(selected);
        }
    }

    const bool canActOnOutgoing = hasOutgoing && outgoingSelection < outgoing.size();
    if (view_.outgoingActionsMenu != nullptr && view_.outgoingActionsMenu->GetFirstButton() != nullptr)
    {
        const bool blockedReceiver = canActOnOutgoing && dataStore_.IsBlocked(outgoing[outgoingSelection].addressee.id);
        const std::array<lila::shared::ui::controls::VerticalMenuItem, 3> items = {{
            {"cancel-request", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionCancel)},
            {"view-profile", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionView)},
            {"block-user", blockedReceiver ? lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionUnblock)
                                           : lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionBlock)},
        }};
        const auto selected = view_.outgoingActionsMenu->GetSelectedIndex();
        view_.outgoingActionsMenu->SetItems(std::span<const lila::shared::ui::controls::VerticalMenuItem>{items.data(), items.size()});
        if (selected < view_.outgoingActionsMenu->GetItemCount())
        {
            view_.outgoingActionsMenu->SetSelectedIndexSilently(selected);
        }
    }

    view_.friendsPanel->Layout();
    view_.incomingRequestsPanel->Layout();
    view_.outgoingRequestsPanel->Layout();
    view_.blockedPanel->Layout();
}

std::optional<int> SocialSectionPresenter::GetSelectedUserId() const
{
    if (navigationState_.currentSection == SocialSection::Profile)
    {
        return navigationState_.profileTargetUserId.has_value()
            ? navigationState_.profileTargetUserId
            : dataStore_.UserIdAt(SocialSection::Profile, 0);
    }

    lila::shared::ui::controls::VerticalMenu* list = nullptr;
    switch (navigationState_.currentSection)
    {
    case SocialSection::Friends: list = view_.friendsList; break;
    case SocialSection::IncomingRequests: list = view_.incomingRequestsList; break;
    case SocialSection::OutgoingRequests: list = view_.outgoingRequestsList; break;
    case SocialSection::Blocked: list = view_.blockedUsersList; break;
    case SocialSection::Profile: break;
    }
    if (list == nullptr || list->GetItemCount() == 0)
    {
        return std::nullopt;
    }
    return dataStore_.UserIdAt(navigationState_.currentSection, list->GetSelectedIndex());
}
}
