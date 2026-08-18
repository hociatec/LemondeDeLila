#include "shared/text/Encoding.h"
#include "modules/social/presentation/SocialSectionPresenter.h"

#include <array>
#include <span>
#include <string>
#include <vector>

#include <wx/button.h>
#include <wx/choice.h>
#include <wx/frame.h>
#include <wx/panel.h>
#include <wx/simplebook.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "modules/social/presentation/SocialDataStore.h"
#include "modules/social/presentation/SocialNavigationState.h"
#include "modules/social/presentation/SocialPresentationModel.h"
#include "modules/social/presentation/SocialProfileMapper.h"
#include "modules/social/presentation/SocialSelectionMemory.h"
#include "modules/social/presentation/SocialView.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::social::presentation
{
namespace
{
template <typename T, typename Formatter>
void PopulateMenu(lila::shared::ui::controls::VerticalMenu& list, const std::vector<T>& items, Formatter formatter)
{
    std::vector<lila::shared::ui::controls::VerticalMenuItem> menuItems;
    menuItems.reserve(items.size());
    for (std::size_t index = 0; index < items.size(); ++index)
    {
        menuItems.push_back({std::to_string(index), formatter(items[index])});
    }
    list.SetItems(std::span<const lila::shared::ui::controls::VerticalMenuItem>{menuItems.data(), menuItems.size()});
}
}

SocialSectionPresenter::SocialSectionPresenter(
    wxFrame& owner,
    SocialView& view,
    SocialDataStore& dataStore,
    SocialNavigationState& navigationState,
    SocialSelectionMemory& selectionMemory) noexcept
    : owner_(owner), view_(view), dataStore_(dataStore), navigationState_(navigationState), selectionMemory_(selectionMemory)
{
}

void SocialSectionPresenter::PopulateSection(SocialSection section)
{
    switch (section)
    {
    case SocialSection::Friends:
        PopulateMenu(*view_.friendsList, dataStore_.Friends(), [](const domain::SocialUser& user)
        {
            return SocialPresentationModel::BuildUserLabel(user);
        });
        RestoreSelection(*view_.friendsList, section);
        break;
    case SocialSection::IncomingRequests:
        PopulateMenu(*view_.incomingRequestsList, dataStore_.IncomingRequests(), [](const domain::SocialFriendRequest& request)
        {
            return SocialPresentationModel::BuildRequestLabel(request, true);
        });
        RestoreSelection(*view_.incomingRequestsList, section);
        break;
    case SocialSection::OutgoingRequests:
        PopulateMenu(*view_.outgoingRequestsList, dataStore_.OutgoingRequests(), [](const domain::SocialFriendRequest& request)
        {
            return SocialPresentationModel::BuildRequestLabel(request, false);
        });
        RestoreSelection(*view_.outgoingRequestsList, section);
        break;
    case SocialSection::Blocked:
        PopulateMenu(*view_.blockedUsersList, dataStore_.BlockedUsers(), [](const domain::SocialUser& user)
        {
            return SocialPresentationModel::BuildUserLabel(user);
        });
        RestoreSelection(*view_.blockedUsersList, section);
        break;
    case SocialSection::Profile:
        break;
    }
}

void SocialSectionPresenter::StoreSelection(SocialSection section)
{
    lila::shared::ui::controls::VerticalMenu* list = nullptr;
    switch (section)
    {
    case SocialSection::Friends: list = view_.friendsList; break;
    case SocialSection::IncomingRequests: list = view_.incomingRequestsList; break;
    case SocialSection::OutgoingRequests: list = view_.outgoingRequestsList; break;
    case SocialSection::Blocked: list = view_.blockedUsersList; break;
    case SocialSection::Profile: return;
    }

    selectionMemory_.Store(
        section,
        list != nullptr && list->GetItemCount() > 0
            ? std::optional<std::size_t>{list->GetSelectedIndex()}
            : std::nullopt);
}

void SocialSectionPresenter::RestoreSelection(
    lila::shared::ui::controls::VerticalMenu& list,
    SocialSection section)
{
    const auto selection = selectionMemory_.Restore(section, list.GetItemCount());
    if (selection.has_value())
    {
        list.SetSelectedIndex(*selection);
    }
}

void SocialSectionPresenter::ShowOnlySectionPanel(wxWindow* targetPanel)
{
    if (view_.sectionBook == nullptr || targetPanel == nullptr)
    {
        return;
    }

    const std::array<wxWindow*, 5> panels = {
        view_.friendsPanel,
        view_.incomingRequestsPanel,
        view_.outgoingRequestsPanel,
        view_.blockedPanel,
        view_.profilePanel,
    };
    for (std::size_t index = 0; index < panels.size(); ++index)
    {
        if (panels[index] == targetPanel)
        {
            view_.sectionBook->SetSelection(index);
            view_.sectionBook->Layout();
            owner_.Layout();
            return;
        }
    }
}

void SocialSectionPresenter::ShowCurrentSection()
{
    switch (navigationState_.currentSection)
    {
    case SocialSection::Friends: ShowOnlySectionPanel(view_.friendsPanel); return;
    case SocialSection::IncomingRequests: ShowOnlySectionPanel(view_.incomingRequestsPanel); return;
    case SocialSection::OutgoingRequests: ShowOnlySectionPanel(view_.outgoingRequestsPanel); return;
    case SocialSection::Blocked: ShowOnlySectionPanel(view_.blockedPanel); return;
    case SocialSection::Profile:
        ShowOnlySectionPanel(view_.profilePanel);
        SyncProfileEditorVisibility();
        return;
    }
}

void SocialSectionPresenter::SyncProfileEditorVisibility()
{
    using Mode = SocialNavigationState::ProfileEditorMode;
    view_.profileEditorMenuPanel->Show(navigationState_.profileEditorMode == Mode::Menu);
    view_.profileBioEditorPanel->Show(navigationState_.profileEditorMode == Mode::Bio);
    view_.profileVictoryEditorPanel->Show(navigationState_.profileEditorMode == Mode::VictoryMessage);
    view_.profileDefeatEditorPanel->Show(navigationState_.profileEditorMode == Mode::DefeatMessage);
    view_.profileVisibilityEditorPanel->Show(navigationState_.profileEditorMode == Mode::Visibility);
    view_.profilePanel->Layout();
}

void SocialSectionPresenter::SyncProfileControls()
{
    using Mode = SocialNavigationState::ProfileEditorMode;
    const auto& currentProfile = dataStore_.Profile();
    if (!currentProfile.has_value())
    {
        view_.profileTitleLabel->SetLabel(lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileTitle));
        view_.profileInfoCtrl->SetValue(wxEmptyString);
        view_.profileBioCtrl->SetValue(wxEmptyString);
        view_.profileVictoryCtrl->SetValue(wxEmptyString);
        view_.profileDefeatCtrl->SetValue(wxEmptyString);
        view_.profileVisibilityChoice->SetSelection(0);
        view_.profileMenu->Show(false);
        view_.profileSaveButton->SetLabel(lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileSave));
        view_.profileSaveButton->Show(false);
        view_.profileSaveButton->Enable(false);
        SyncProfileEditorVisibility();
        return;
    }

    const auto& profile = *currentProfile;
    view_.profileTitleLabel->SetLabel(profile.isOwner
        ? lila::shared::text::FromUtf8(lila::shared::errors::SocialMenuProfile)
        : lila::shared::text::FromUtf8(profile.user.username));
    view_.profileInfoCtrl->SetValue(SocialPresentationModel::BuildProfileInfoText(profile));
    view_.profileBioCtrl->SetValue(lila::shared::text::FromUtf8(profile.bio));
    view_.profileVictoryCtrl->SetValue(lila::shared::text::FromUtf8(profile.victoryMessage));
    view_.profileDefeatCtrl->SetValue(lila::shared::text::FromUtf8(profile.defeatMessage));
    view_.profileVisibilityChoice->SetSelection(SocialProfileMapper::ChoiceIndexFromVisibility(profile.visibility));
    view_.profileMenu->Show(profile.isOwner);

    if (!profile.isOwner || navigationState_.profileEditorMode == Mode::Menu)
    {
        view_.profileSaveButton->SetLabel(lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileSave));
        view_.profileSaveButton->Show(false);
        view_.profileSaveButton->Enable(false);
    }
    else
    {
        const char* label = lila::shared::errors::SocialProfileSave;
        switch (navigationState_.profileEditorMode)
        {
        case Mode::Bio: label = lila::shared::errors::SocialProfileSaveBio; break;
        case Mode::VictoryMessage:
        case Mode::DefeatMessage: label = lila::shared::errors::SocialProfileSaveMessage; break;
        case Mode::Visibility: label = lila::shared::errors::SocialProfileSaveVisibility; break;
        case Mode::Menu: break;
        }
        view_.profileSaveButton->SetLabel(lila::shared::text::FromUtf8(label));
        view_.profileSaveButton->Show(true);
        view_.profileSaveButton->Enable(true);
    }

    view_.profileCancelButton->Enable(true);
    SyncProfileEditorVisibility();
    view_.profilePanel->Layout();
}

void SocialSectionPresenter::SyncSelectionState()
{
    const auto& friends = dataStore_.Friends();
    const auto& incoming = dataStore_.IncomingRequests();
    const auto& outgoing = dataStore_.OutgoingRequests();
    const auto& blocked = dataStore_.BlockedUsers();

    const bool hasFriends = view_.friendsList->GetItemCount() > 0;
    const bool hasIncoming = view_.incomingRequestsList->GetItemCount() > 0;
    const bool hasOutgoing = view_.outgoingRequestsList->GetItemCount() > 0;
    const bool hasBlocked = view_.blockedUsersList->GetItemCount() > 0;
    const std::size_t friendSelection = view_.friendsList->GetSelectedIndex();
    const std::size_t incomingSelection = view_.incomingRequestsList->GetSelectedIndex();
    const std::size_t outgoingSelection = view_.outgoingRequestsList->GetSelectedIndex();
    const std::size_t blockedSelection = view_.blockedUsersList->GetSelectedIndex();

    view_.friendsList->Show(hasFriends);
    view_.emptyFriendsCtrl->Show(!hasFriends);
    view_.incomingRequestsList->Show(hasIncoming);
    view_.emptyIncomingRequestsCtrl->Show(!hasIncoming);
    view_.outgoingRequestsList->Show(hasOutgoing);
    view_.emptyOutgoingRequestsCtrl->Show(!hasOutgoing);
    view_.blockedUsersList->Show(hasBlocked);
    view_.emptyBlockedUsersCtrl->Show(!hasBlocked);

    const bool canActOnFriends = hasFriends && friendSelection < friends.size();
    if (view_.friendsActionsMenu != nullptr && view_.friendsActionsMenu->GetFirstButton() != nullptr)
    {
        view_.friendsActionsMenu->GetFirstButton()->Enable(canActOnFriends);
        const bool blockedFriend = canActOnFriends && dataStore_.IsBlocked(friends[friendSelection].id);
        const std::array<lila::shared::ui::controls::VerticalMenuItem, 3> items = {{
            {"view-profile", lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileActionView)},
            {"remove-friend", lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileActionRemoveFriend)},
            {"block-friend", blockedFriend ? lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileActionUnblock)
                                           : lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileActionBlock)},
        }};
        const auto selected = view_.friendsActionsMenu->GetSelectedIndex();
        view_.friendsActionsMenu->SetItems(std::span<const lila::shared::ui::controls::VerticalMenuItem>{items.data(), items.size()});
        if (selected < view_.friendsActionsMenu->GetItemCount()) view_.friendsActionsMenu->SetSelectedIndex(selected);
    }

    const bool canActOnIncoming = hasIncoming && incomingSelection < incoming.size();
    if (view_.incomingActionsMenu != nullptr && view_.incomingActionsMenu->GetFirstButton() != nullptr)
    {
        view_.incomingActionsMenu->GetFirstButton()->Enable(canActOnIncoming);
        const bool blockedSender = canActOnIncoming && dataStore_.IsBlocked(incoming[incomingSelection].requester.id);
        const std::array<lila::shared::ui::controls::VerticalMenuItem, 4> items = {{
            {"accept-request", lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileActionAccept)},
            {"reject-request", lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileActionReject)},
            {"view-profile", lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileActionView)},
            {"block-user", blockedSender ? lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileActionUnblock)
                                          : lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileActionBlock)},
        }};
        const auto selected = view_.incomingActionsMenu->GetSelectedIndex();
        view_.incomingActionsMenu->SetItems(std::span<const lila::shared::ui::controls::VerticalMenuItem>{items.data(), items.size()});
        if (selected < view_.incomingActionsMenu->GetItemCount()) view_.incomingActionsMenu->SetSelectedIndex(selected);
    }

    const bool canActOnOutgoing = hasOutgoing && outgoingSelection < outgoing.size();
    if (view_.outgoingActionsMenu != nullptr && view_.outgoingActionsMenu->GetFirstButton() != nullptr)
    {
        view_.outgoingActionsMenu->GetFirstButton()->Enable(canActOnOutgoing);
        const bool blockedReceiver = canActOnOutgoing && dataStore_.IsBlocked(outgoing[outgoingSelection].addressee.id);
        const std::array<lila::shared::ui::controls::VerticalMenuItem, 3> items = {{
            {"cancel-request", lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileActionCancel)},
            {"view-profile", lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileActionView)},
            {"block-user", blockedReceiver ? lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileActionUnblock)
                                            : lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileActionBlock)},
        }};
        const auto selected = view_.outgoingActionsMenu->GetSelectedIndex();
        view_.outgoingActionsMenu->SetItems(std::span<const lila::shared::ui::controls::VerticalMenuItem>{items.data(), items.size()});
        if (selected < view_.outgoingActionsMenu->GetItemCount()) view_.outgoingActionsMenu->SetSelectedIndex(selected);
    }

    const bool canUnblock = hasBlocked && blockedSelection < blocked.size();
    if (view_.blockedActionsMenu != nullptr && view_.blockedActionsMenu->GetFirstButton() != nullptr)
    {
        view_.blockedActionsMenu->GetFirstButton()->Enable(canUnblock);
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
