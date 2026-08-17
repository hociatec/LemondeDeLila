#include "modules/social/presentation/SocialFrame.h"

#include <array>
#include <memory>
#include <string>
#include <span>
#include <unordered_set>

#include <wx/button.h>
#include <wx/choice.h>
#include <wx/panel.h>
#include <wx/simplebook.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "modules/social/application/SocialService.h"
#include "shared/ui/Theme.h"
#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/ui/controls/VerticalMenu.h"
#include "shared/errors/ErrorMessages.h"

namespace lila::modules::social::presentation
{
namespace
{
const auto* kProfileUnavailableStatus = lila::shared::errors::SocialProfileUnavailable;

template <typename T, typename Formatter>
void PopulateList(lila::shared::ui::controls::VerticalMenu& list, const std::vector<T>& items, const Formatter& formatter)
{
    std::vector<lila::shared::ui::controls::VerticalMenuItem> menuItems;
    menuItems.reserve(items.size());
    for (std::size_t index = 0; index < items.size(); ++index)
    {
        menuItems.push_back({std::to_string(index), formatter(items[index])});
    }

    list.SetItems(std::span<const lila::shared::ui::controls::VerticalMenuItem>{menuItems.data(), menuItems.size()});
}

std::vector<domain::SocialUser> MergeFriendsAndBlockedUsers(
    std::vector<domain::SocialUser> friends,
    const std::vector<domain::SocialUser>& blockedUsers)
{
    std::unordered_set<int> friendIds;
    friendIds.reserve(friends.size());
    for (const auto& friendUser : friends)
    {
        if (friendUser.id > 0)
        {
            friendIds.insert(friendUser.id);
        }
    }

    for (const auto& blockedUser : blockedUsers)
    {
        if (blockedUser.id <= 0 || blockedUser.since.empty() || friendIds.contains(blockedUser.id))
        {
            continue;
        }

        friends.push_back(blockedUser);
        friendIds.insert(blockedUser.id);
    }

    return friends;
}

}

void SocialFrame::SetSection(Section section, bool restoreFocus)
{
    if (section != currentSection_)
    {
        StoreSectionSelection(currentSection_);
    }

    currentSection_ = section;
    lastMenuIndex_ = SectionToMenuIndex(section);
    if (menu_ != nullptr)
    {
        menu_->SetSelectedIndex(lastMenuIndex_);
    }

    switch (section)
    {
    case Section::Friends:
        LoadFriends();
        break;
    case Section::IncomingRequests:
        LoadIncomingRequests();
        break;
    case Section::OutgoingRequests:
        LoadOutgoingRequests();
        break;
    case Section::Blocked:
        LoadBlockedUsers();
        break;
    case Section::Profile:
        SyncSectionVisibility();
        SyncProfileControls();
        break;
    }

    currentScreen_ = Screen::Section;
    static_cast<void>(restoreFocus);
}

void SocialFrame::UpdateStatus(const wxString& message, bool isError)
{
    if (statusLabel_ == nullptr)
    {
        return;
    }

    statusLabel_->SetLabel(message);
    statusLabel_->SetForegroundColour(isError ? wxColour(255, 170, 170) : lila::shared::ui::Theme::Accent());
    statusLabel_->Wrap(GetClientSize().GetWidth() - 80);
    statusLabel_->GetParent()->Layout();
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleStatus(*statusLabel_, message);
}

void SocialFrame::RefreshCurrentSection()
{
    if (currentScreen_ != Screen::Section)
    {
        return;
    }

    switch (currentSection_)
    {
    case Section::Friends:
        LoadFriends();
        return;
    case Section::IncomingRequests:
        LoadIncomingRequests();
        return;
    case Section::OutgoingRequests:
        LoadOutgoingRequests();
        return;
    case Section::Blocked:
        LoadBlockedUsers();
        return;
    case Section::Profile:
        LoadProfile(profileTargetUserId_);
        return;
    }
}

void SocialFrame::RefreshAllCaches()
{
    friends_ = socialService_.LoadFriends();
    incomingRequests_ = socialService_.LoadIncomingRequests();
    outgoingRequests_ = socialService_.LoadOutgoingRequests();
    blockedUsers_ = socialService_.LoadBlockedUsers();
}

void SocialFrame::LoadFriends()
{
    auto results = std::make_shared<std::vector<domain::SocialUser>>();
    auto blockedResults = std::make_shared<std::vector<domain::SocialUser>>();
    RunBackgroundTask(
        wxString::FromUTF8(lila::shared::errors::SocialLoadFriendsBusy),
        [this, results, blockedResults]()
        {
            *results = socialService_.LoadFriends();
            *blockedResults = socialService_.LoadBlockedUsers();
        },
        [this, results, blockedResults]()
        {
            friends_ = std::move(*results);
            blockedUsers_ = std::move(*blockedResults);
            friends_ = MergeFriendsAndBlockedUsers(std::move(friends_), blockedUsers_);
            PopulateList(*friendsList_, friends_, [this](const domain::SocialUser& user) { return BuildUserLabel(user); });
            RestoreSectionSelection(*friendsList_, Section::Friends);

            SyncSectionVisibility();
            SyncSelectionState();
            UpdateStatus(BuildSectionStatus(Section::Friends, friends_.size()));
            if (currentSection_ == Section::Friends)
            {
                FocusCurrentScreen();
            }
        });
}

void SocialFrame::LoadIncomingRequests()
{
    auto results = std::make_shared<std::vector<domain::SocialFriendRequest>>();
    auto blockedResults = std::make_shared<std::vector<domain::SocialUser>>();
    RunBackgroundTask(
        wxString::FromUTF8(lila::shared::errors::SocialLoadIncomingRequestsBusy),
        [this, results, blockedResults]()
        {
            *results = socialService_.LoadIncomingRequests();
            *blockedResults = socialService_.LoadBlockedUsers();
        },
        [this, results, blockedResults]()
        {
            incomingRequests_ = std::move(*results);
            blockedUsers_ = std::move(*blockedResults);
            PopulateList(*incomingRequestsList_, incomingRequests_, [this](const domain::SocialFriendRequest& request)
            { return BuildRequestLabel(request, true); });
            RestoreSectionSelection(*incomingRequestsList_, Section::IncomingRequests);

            SyncSectionVisibility();
            SyncSelectionState();
            UpdateStatus(BuildSectionStatus(Section::IncomingRequests, incomingRequests_.size()));
            if (currentSection_ == Section::IncomingRequests)
            {
                FocusCurrentScreen();
            }
        });
}

void SocialFrame::LoadOutgoingRequests()
{
    auto results = std::make_shared<std::vector<domain::SocialFriendRequest>>();
    auto blockedResults = std::make_shared<std::vector<domain::SocialUser>>();
    RunBackgroundTask(
        wxString::FromUTF8(lila::shared::errors::SocialLoadOutgoingRequestsBusy),
        [this, results, blockedResults]()
        {
            *results = socialService_.LoadOutgoingRequests();
            *blockedResults = socialService_.LoadBlockedUsers();
        },
        [this, results, blockedResults]()
        {
            outgoingRequests_ = std::move(*results);
            blockedUsers_ = std::move(*blockedResults);
            PopulateList(*outgoingRequestsList_, outgoingRequests_, [this](const domain::SocialFriendRequest& request)
            { return BuildRequestLabel(request, false); });
            RestoreSectionSelection(*outgoingRequestsList_, Section::OutgoingRequests);

            SyncSectionVisibility();
            SyncSelectionState();
            UpdateStatus(BuildSectionStatus(Section::OutgoingRequests, outgoingRequests_.size()));
            if (currentSection_ == Section::OutgoingRequests)
            {
                FocusCurrentScreen();
            }
        });
}

void SocialFrame::LoadBlockedUsers()
{
    auto results = std::make_shared<std::vector<domain::SocialUser>>();
    RunBackgroundTask(
        wxString::FromUTF8(lila::shared::errors::SocialLoadBlockedUsersBusy),
        [this, results]()
        {
            *results = socialService_.LoadBlockedUsers();
        },
        [this, results]()
        {
            blockedUsers_ = std::move(*results);
            PopulateList(*blockedUsersList_, blockedUsers_, [this](const domain::SocialUser& user) { return BuildUserLabel(user); });
            RestoreSectionSelection(*blockedUsersList_, Section::Blocked);

            SyncSectionVisibility();
            SyncSelectionState();
            UpdateStatus(BuildSectionStatus(Section::Blocked, blockedUsers_.size()));
            if (currentSection_ == Section::Blocked)
            {
                FocusCurrentScreen();
            }
        });
}

void SocialFrame::LoadProfile(std::optional<int> userId)
{
    profileTargetUserId_ = userId;
    profileEditorMode_ = ProfileEditorMode::Menu;
    auto result = std::make_shared<std::optional<domain::SocialProfile>>();
    RunBackgroundTask(
        wxString::FromUTF8(lila::shared::errors::SocialProfileLoading),
        [this, result, userId]()
        {
            *result = socialService_.LoadProfile(userId);
        },
        [this, result]()
        {
            currentProfile_ = *result;
            SyncSectionVisibility();
            SyncProfileControls();

            if (!currentProfile_.has_value())
            {
                UpdateStatus(wxString::FromUTF8(kProfileUnavailableStatus), true);
                return;
            }

            profileTitleLabel_->SetLabel(currentProfile_->isOwner
                ? wxString(L"Mon profil")
                : wxString::FromUTF8(currentProfile_->user.username));

            if (!currentProfile_->isOwner && !currentProfile_->canView)
            {
                UpdateStatus(wxString::FromUTF8(lila::shared::errors::SocialProfilePrivate));
            }
            else
            {
                UpdateStatus(wxString::FromUTF8(lila::shared::errors::SocialProfileLoaded));
            }

            if (currentSection_ == Section::Profile)
            {
                FocusCurrentScreen();
            }
        });
}

void SocialFrame::SaveProfile()
{
    if (!currentProfile_.has_value() || !currentProfile_->isOwner)
    {
        UpdateStatus(wxString::FromUTF8(lila::shared::errors::SocialOnlyOwnProfileEditable), true);
        return;
    }

    domain::SocialProfileUpdate update;
    update.bio = profileBioCtrl_->GetValue().ToUTF8().data();
    update.victoryMessage = profileVictoryCtrl_->GetValue().ToUTF8().data();
    update.defeatMessage = profileDefeatCtrl_->GetValue().ToUTF8().data();

    switch (profileVisibilityChoice_->GetSelection())
    {
    case 0:
        update.visibility = "public";
        break;
    case 1:
        update.visibility = "friends";
        break;
    case 2:
        update.visibility = "private";
        break;
    default:
        update.visibility = "public";
        break;
    }

    auto result = std::make_shared<std::optional<domain::SocialProfile>>();
    RunBackgroundTask(
            wxString::FromUTF8(lila::shared::errors::SocialSaveProfileBusy),
        [this, result, update]()
        {
            *result = socialService_.SaveProfile(update);
        },
        [this, result]()
        {
            currentProfile_ = *result;
            profileEditorMode_ = ProfileEditorMode::Menu;
            SyncProfileControls();
            ShowActionFeedback(wxString::FromUTF8(lila::shared::errors::SocialProfileUpdated));
            if (currentSection_ == Section::Profile)
            {
                FocusCurrentScreen();
            }
        });
}

void SocialFrame::StartProfileEdit(ProfileEditorMode mode)
{
    profileEditorMode_ = mode;
    SyncProfileControls();
    FocusCurrentScreen();
}

void SocialFrame::ExitProfileEditMode()
{
    profileEditorMode_ = ProfileEditorMode::Menu;
    SyncProfileEditorVisibility();
    if (profileMenu_ != nullptr)
    {
        profileMenu_->FocusSelectedItem();
    }
    SyncProfileControls();
}

bool SocialFrame::TryExitProfile()
{
    if (profileEditorMode_ != ProfileEditorMode::Menu)
    {
        ExitProfileEditMode();
        return true;
    }

    if (returnSectionFromProfile_.has_value())
    {
        const Section section = *returnSectionFromProfile_;
        returnSectionFromProfile_.reset();
        profileTargetUserId_.reset();
        SetSection(section, true);
        return true;
    }

    return false;
}

void SocialFrame::ShowOnlySectionPanel(wxWindow* targetPanel)
{
    if (sectionBook_ == nullptr || targetPanel == nullptr)
    {
        return;
    }

    const std::array<wxWindow*, 5> panels = {
        friendsPanel_,
        incomingRequestsPanel_,
        outgoingRequestsPanel_,
        blockedPanel_,
        profilePanel_,
    };

    for (std::size_t index = 0; index < panels.size(); ++index)
    {
        if (panels[index] == nullptr)
        {
            continue;
        }

        if (panels[index] == targetPanel)
        {
            sectionBook_->SetSelection(index);
            sectionBook_->Layout();
            Layout();
            return;
        }
    }
}

void SocialFrame::SyncSectionVisibility()
{
    switch (currentSection_)
    {
    case Section::Friends:
        ShowOnlySectionPanel(friendsPanel_);
        return;
    case Section::IncomingRequests:
        ShowOnlySectionPanel(incomingRequestsPanel_);
        return;
    case Section::OutgoingRequests:
        ShowOnlySectionPanel(outgoingRequestsPanel_);
        return;
    case Section::Blocked:
        ShowOnlySectionPanel(blockedPanel_);
        return;
    case Section::Profile:
        ShowOnlySectionPanel(profilePanel_);
        SyncProfileEditorVisibility();
        return;
    }
}

void SocialFrame::SyncProfileEditorVisibility()
{
    profileEditorMenuPanel_->Show(profileEditorMode_ == ProfileEditorMode::Menu);
    profileBioEditorPanel_->Show(profileEditorMode_ == ProfileEditorMode::Bio);
    profileVictoryEditorPanel_->Show(profileEditorMode_ == ProfileEditorMode::VictoryMessage);
    profileDefeatEditorPanel_->Show(profileEditorMode_ == ProfileEditorMode::DefeatMessage);
    profileVisibilityEditorPanel_->Show(profileEditorMode_ == ProfileEditorMode::Visibility);
    profilePanel_->Layout();
}

void SocialFrame::SyncProfileControls()
{
    if (!currentProfile_.has_value())
    {
        profileTitleLabel_->SetLabel(wxString(L"Profil"));
        profileInfoCtrl_->SetValue(wxEmptyString);
        profileBioCtrl_->SetValue(wxEmptyString);
        profileVictoryCtrl_->SetValue(wxEmptyString);
        profileDefeatCtrl_->SetValue(wxEmptyString);
        profileVisibilityChoice_->SetSelection(0);
        profileMenu_->Show(false);
        profileSaveButton_->SetLabel(wxString(L"Enregistrer"));
        profileSaveButton_->Show(false);
        profileSaveButton_->Enable(false);
        SyncProfileEditorVisibility();
        return;
    }

    const auto& profile = *currentProfile_;
    profileTitleLabel_->SetLabel(profile.isOwner ? wxString(L"Mon profil") : wxString::FromUTF8(profile.user.username));
    profileInfoCtrl_->SetValue(BuildProfileInfoText(profile));
    profileBioCtrl_->SetValue(wxString::FromUTF8(profile.bio));
    profileVictoryCtrl_->SetValue(wxString::FromUTF8(profile.victoryMessage));
    profileDefeatCtrl_->SetValue(wxString::FromUTF8(profile.defeatMessage));

    if (profile.visibility == "friends")
    {
        profileVisibilityChoice_->SetSelection(1);
    }
    else if (profile.visibility == "private")
    {
        profileVisibilityChoice_->SetSelection(2);
    }
    else
    {
        profileVisibilityChoice_->SetSelection(0);
    }

    profileMenu_->Show(profile.isOwner);
    if (!profile.isOwner || profileEditorMode_ == ProfileEditorMode::Menu)
    {
        profileSaveButton_->SetLabel(wxString(L"Enregistrer"));
        profileSaveButton_->Show(false);
        profileSaveButton_->Enable(false);
    }
    else
    {
        switch (profileEditorMode_)
        {
        case ProfileEditorMode::Bio:
            profileSaveButton_->SetLabel(wxString(L"Enregistrer la bio"));
            break;
        case ProfileEditorMode::VictoryMessage:
            profileSaveButton_->SetLabel(wxString(L"Enregistrer le message"));
            break;
        case ProfileEditorMode::DefeatMessage:
            profileSaveButton_->SetLabel(wxString(L"Enregistrer le message"));
            break;
        case ProfileEditorMode::Visibility:
            profileSaveButton_->SetLabel(wxString(L"Enregistrer la visibilité"));
            break;
        case ProfileEditorMode::Menu:
            profileSaveButton_->SetLabel(wxString(L"Enregistrer"));
            break;
        }

        profileSaveButton_->Show(true);
        profileSaveButton_->Enable(true);
    }

    profileCancelButton_->Enable(true);
    SyncProfileEditorVisibility();
    profilePanel_->Layout();
}

void SocialFrame::SyncSelectionState()
{
    const bool hasFriends = friendsList_->GetItemCount() > 0;
    const bool hasIncomingRequests = incomingRequestsList_->GetItemCount() > 0;
    const bool hasOutgoingRequests = outgoingRequestsList_->GetItemCount() > 0;
    const bool hasBlockedUsers = blockedUsersList_->GetItemCount() > 0;
    const std::size_t friendSelection = friendsList_->GetSelectedIndex();
    const std::size_t incomingSelection = incomingRequestsList_->GetSelectedIndex();
    const std::size_t outgoingSelection = outgoingRequestsList_->GetSelectedIndex();
    const std::size_t blockedSelection = blockedUsersList_->GetSelectedIndex();

    friendsList_->Show(hasFriends);
    emptyFriendsCtrl_->Show(!hasFriends);
    incomingRequestsList_->Show(hasIncomingRequests);
    emptyIncomingRequestsCtrl_->Show(!hasIncomingRequests);
    outgoingRequestsList_->Show(hasOutgoingRequests);
    emptyOutgoingRequestsCtrl_->Show(!hasOutgoingRequests);
    blockedUsersList_->Show(hasBlockedUsers);
    emptyBlockedUsersCtrl_->Show(!hasBlockedUsers);

    const bool canActOnFriends = hasFriends && friendSelection < friends_.size();
    if (friendsActionsMenu_ != nullptr && friendsActionsMenu_->GetFirstButton() != nullptr)
    {
        friendsActionsMenu_->GetFirstButton()->Enable(canActOnFriends);

        const bool blockedFriend = friendSelection < friends_.size() && IsBlockedUser(friends_[friendSelection].id);
        const std::array<lila::shared::ui::controls::VerticalMenuItem, 3> menuItems = {{
            {"view-profile", wxString(L"Voir le profil")},
            {"remove-friend", wxString(L"Retirer de ma liste d'amis")},
            {"block-friend", blockedFriend ? wxString(L"Débloquer") : wxString(L"Bloquer")},
        }};
        const std::size_t selectedAction = friendsActionsMenu_->GetSelectedIndex();
        friendsActionsMenu_->SetItems(std::span<const lila::shared::ui::controls::VerticalMenuItem>{menuItems.data(), menuItems.size()});
        if (selectedAction < friendsActionsMenu_->GetItemCount())
        {
            friendsActionsMenu_->SetSelectedIndex(selectedAction);
        }
    }

    const bool canActOnIncoming = hasIncomingRequests && incomingSelection < incomingRequests_.size();
    if (incomingActionsMenu_ != nullptr && incomingActionsMenu_->GetFirstButton() != nullptr)
    {
        incomingActionsMenu_->GetFirstButton()->Enable(canActOnIncoming);

        const bool blockedSender = incomingSelection < incomingRequests_.size() &&
            IsBlockedUser(incomingRequests_[incomingSelection].requester.id);
        const std::array<lila::shared::ui::controls::VerticalMenuItem, 4> menuItems = {{
            {"accept-request", wxString(L"Accepter")},
            {"reject-request", wxString(L"Refuser")},
            {"view-profile", wxString(L"Voir le profil")},
            {"block-user", blockedSender ? wxString(L"Débloquer") : wxString(L"Bloquer")},
        }};
        const std::size_t selectedAction = incomingActionsMenu_->GetSelectedIndex();
        incomingActionsMenu_->SetItems(std::span<const lila::shared::ui::controls::VerticalMenuItem>{menuItems.data(), menuItems.size()});
        if (selectedAction < incomingActionsMenu_->GetItemCount())
        {
            incomingActionsMenu_->SetSelectedIndex(selectedAction);
        }
    }

    const bool canActOnOutgoing = hasOutgoingRequests && outgoingSelection < outgoingRequests_.size();
    if (outgoingActionsMenu_ != nullptr && outgoingActionsMenu_->GetFirstButton() != nullptr)
    {
        outgoingActionsMenu_->GetFirstButton()->Enable(canActOnOutgoing);

        const bool blockedReceiver = outgoingSelection < outgoingRequests_.size() &&
            IsBlockedUser(outgoingRequests_[outgoingSelection].addressee.id);
        const std::array<lila::shared::ui::controls::VerticalMenuItem, 3> menuItems = {{
            {"cancel-request", wxString(L"Annuler")},
            {"view-profile", wxString(L"Voir le profil")},
            {"block-user", blockedReceiver ? wxString(L"Débloquer") : wxString(L"Bloquer")},
        }};
        const std::size_t selectedAction = outgoingActionsMenu_->GetSelectedIndex();
        outgoingActionsMenu_->SetItems(std::span<const lila::shared::ui::controls::VerticalMenuItem>{menuItems.data(), menuItems.size()});
        if (selectedAction < outgoingActionsMenu_->GetItemCount())
        {
            outgoingActionsMenu_->SetSelectedIndex(selectedAction);
        }
    }

    const bool canUnblock = hasBlockedUsers && blockedSelection < blockedUsers_.size();
    if (blockedActionsMenu_ != nullptr && blockedActionsMenu_->GetFirstButton() != nullptr)
    {
        blockedActionsMenu_->GetFirstButton()->Enable(canUnblock);
    }

    friendsPanel_->Layout();
    incomingRequestsPanel_->Layout();
    outgoingRequestsPanel_->Layout();
    blockedPanel_->Layout();
}

bool SocialFrame::IsBlockedUser(int userId) const
{
    for (const auto& user : blockedUsers_)
    {
        if (user.id == userId)
        {
            return true;
        }
    }

    return false;
}

std::optional<int> SocialFrame::GetSelectedUserId() const
{
    switch (currentSection_)
    {
    case Section::Friends:
    {
        const std::size_t selection = friendsList_->GetSelectedIndex();
        if (selection >= friends_.size() || friendsList_->GetItemCount() == 0)
        {
            return std::nullopt;
        }
        return friends_[selection].id;
    }
    case Section::IncomingRequests:
    {
        const std::size_t selection = incomingRequestsList_->GetSelectedIndex();
        if (selection >= incomingRequests_.size() || incomingRequestsList_->GetItemCount() == 0)
        {
            return std::nullopt;
        }
        return incomingRequests_[selection].requester.id;
    }
    case Section::OutgoingRequests:
    {
        const std::size_t selection = outgoingRequestsList_->GetSelectedIndex();
        if (selection >= outgoingRequests_.size() || outgoingRequestsList_->GetItemCount() == 0)
        {
            return std::nullopt;
        }
        return outgoingRequests_[selection].addressee.id;
    }
    case Section::Blocked:
    {
        const std::size_t selection = blockedUsersList_->GetSelectedIndex();
        if (selection >= blockedUsers_.size() || blockedUsersList_->GetItemCount() == 0)
        {
            return std::nullopt;
        }
        return blockedUsers_[selection].id;
    }
    case Section::Profile:
        return profileTargetUserId_;
    }

    return std::nullopt;
}

wxString SocialFrame::BuildUserLabel(const domain::SocialUser& user) const
{
    if (user.id <= 0)
    {
        return wxString(L"Utilisateur inconnu");
    }

    wxString label = wxString::FromUTF8(user.username.empty() ? "Utilisateur inconnu" : user.username);
    if (!user.blockedAt.empty() && user.since.empty())
    {
        label += wxString(L" - bloqué");
    }
    return label;
}

wxString SocialFrame::BuildRequestLabel(const domain::SocialFriendRequest& request, bool incoming) const
{
    const std::string name = incoming ? request.requester.username : request.addressee.username;
    wxString label = wxString::FromUTF8(name.empty() ? "Utilisateur inconnu" : name);
    if (!request.createdAt.empty())
    {
        label += wxString(L" - ");
        label += wxString::FromUTF8(request.createdAt);
    }
    return label;
}

wxString SocialFrame::BuildProfileInfoText(const domain::SocialProfile& profile) const
{
    wxString text;
    text << wxString(L"Visibilité : ") << wxString::FromUTF8(VisibilityToFrench(profile.visibility)) << '\n';

    if (!profile.createdAt.empty())
    {
        text << wxString(L"Créé : ") << wxString::FromUTF8(profile.createdAt) << '\n';
    }
    if (!profile.updatedAt.empty())
    {
        text << wxString(L"Mis à jour : ") << wxString::FromUTF8(profile.updatedAt) << '\n';
    }

    if (profile.isOwner || profile.canView)
    {
        text << wxString(L"Bio : ")
             << wxString::FromUTF8(profile.bio.empty() ? "(vide)" : profile.bio)
             << "\n\n";
        text << wxString(L"Message de victoire : ")
             << wxString::FromUTF8(profile.victoryMessage.empty() ? "(vide)" : profile.victoryMessage)
             << "\n\n";
        text << wxString(L"Message de défaite : ")
             << wxString::FromUTF8(profile.defeatMessage.empty() ? "(vide)" : profile.defeatMessage);
    }
    else
    {
        text << wxString(L"Ce profil est privé.");
    }

    return text;
}

std::string SocialFrame::VisibilityToFrench(const std::string& value)
{
    if (value == "friends")
    {
        return "Amis";
    }
    if (value == "private")
    {
        return "Privé";
    }
    return "Public";
}

std::optional<SocialFrame::Section> SocialFrame::MenuIndexToSection(std::size_t index)
{
    switch (index)
    {
    case 1:
        return Section::Friends;
    case 2:
        return Section::IncomingRequests;
    case 3:
        return Section::OutgoingRequests;
    case 4:
        return Section::Blocked;
    case 5:
        return Section::Profile;
    default:
        return std::nullopt;
    }
}

std::size_t SocialFrame::SectionToMenuIndex(Section section)
{
    switch (section)
    {
    case Section::Friends:
        return 1;
    case Section::IncomingRequests:
        return 2;
    case Section::OutgoingRequests:
        return 3;
    case Section::Blocked:
        return 4;
    case Section::Profile:
        return 5;
    }

    return 1;
}

wxString SocialFrame::BuildSectionStatus(Section section, std::size_t count)
{
    const auto buildResultsStatus = [](std::size_t resultCount)
    {
        return resultCount == 0
            ? wxString::FromUTF8(lila::shared::errors::SocialSectionResultsEmpty)
            : wxString::Format(wxString::FromUTF8(lila::shared::errors::SocialSectionResultsCount), resultCount);
    };

    switch (section)
    {
    case Section::Friends:
        return buildResultsStatus(count);
    case Section::IncomingRequests:
        return buildResultsStatus(count);
    case Section::OutgoingRequests:
        return buildResultsStatus(count);
    case Section::Blocked:
        return buildResultsStatus(count);
    case Section::Profile:
        return wxString::FromUTF8(lila::shared::errors::SocialProfileLoaded);
    }

    return wxString(L"Social");
}

std::optional<int> SocialFrame::GetStoredSectionSelection(Section section) const
{
    return lastSectionSelection_[SectionIndex(section)];
}

void SocialFrame::StoreSectionSelection(Section section)
{
    if (section == Section::Profile)
    {
        return;
    }

    int selection = -1;
    switch (section)
    {
    case Section::Friends:
        if (friendsList_ != nullptr)
        {
            if (friendsList_ != nullptr && friendsList_->GetItemCount() > 0)
            {
                selection = static_cast<int>(friendsList_->GetSelectedIndex());
            }
        }
        break;
    case Section::IncomingRequests:
        if (incomingRequestsList_ != nullptr)
        {
            if (incomingRequestsList_ != nullptr && incomingRequestsList_->GetItemCount() > 0)
            {
                selection = static_cast<int>(incomingRequestsList_->GetSelectedIndex());
            }
        }
        break;
    case Section::OutgoingRequests:
        if (outgoingRequestsList_ != nullptr)
        {
            if (outgoingRequestsList_ != nullptr && outgoingRequestsList_->GetItemCount() > 0)
            {
                selection = static_cast<int>(outgoingRequestsList_->GetSelectedIndex());
            }
        }
        break;
    case Section::Blocked:
        if (blockedUsersList_ != nullptr)
        {
            if (blockedUsersList_ != nullptr && blockedUsersList_->GetItemCount() > 0)
            {
                selection = static_cast<int>(blockedUsersList_->GetSelectedIndex());
            }
        }
        break;
    case Section::Profile:
        break;
    }

    if (selection < 0)
    {
        lastSectionSelection_[SectionIndex(section)] = std::nullopt;
        return;
    }

    lastSectionSelection_[SectionIndex(section)] = selection;
}

void SocialFrame::RestoreSectionSelection(lila::shared::ui::controls::VerticalMenu& list, Section section)
{
    const auto previousSelection = GetStoredSectionSelection(section);
    const std::size_t count = list.GetItemCount();
    if (previousSelection.has_value() && *previousSelection >= 0 && static_cast<std::size_t>(*previousSelection) < count)
    {
        list.SetSelectedIndex(static_cast<std::size_t>(*previousSelection));
        return;
    }

    if (count > 0)
    {
        list.SetSelectedIndex(0);
    }
}

std::size_t SocialFrame::SectionIndex(Section section)
{
    switch (section)
    {
    case Section::Friends:
        return 0;
    case Section::IncomingRequests:
        return 1;
    case Section::OutgoingRequests:
        return 2;
    case Section::Blocked:
        return 3;
    case Section::Profile:
        return 4;
    }

    return 0;
}
}

