#include "shared/text/Encoding.h"
#include "modules/social/presentation/SocialFrame.h"
#include "modules/social/presentation/SocialFocusController.h"
#include "modules/social/presentation/SocialActionController.h"
#include "modules/social/presentation/SocialView.h"
#include "modules/social/presentation/SocialLoadController.h"
#include "modules/social/presentation/SocialSectionPresenter.h"
#include "modules/social/presentation/SocialProfileMapper.h"

#include <array>
#include <memory>
#include <string>
#include <span>

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
#include "shared/contracts/BackendWsContracts.h"

namespace lila::modules::social::presentation
{
namespace
{
const auto* kProfileUnavailableStatus = lila::shared::errors::SocialProfileUnavailable;


}

void SocialFrame::SetSection(SocialSection section)
{
    if (section != navigationState_.currentSection)
    {
        sectionPresenter_->StoreSelection(navigationState_.currentSection);
    }

    navigationState_.EnterSection(section, SocialPresentationModel::SectionToMenuIndex(section));
    if (view_->menu != nullptr)
    {
        view_->menu->SetSelectedIndex(navigationState_.lastMenuIndex);
    }

    switch (section)
    {
    case SocialSection::Friends:
        LoadFriends();
        break;
    case SocialSection::IncomingRequests:
        LoadIncomingRequests();
        break;
    case SocialSection::OutgoingRequests:
        LoadOutgoingRequests();
        break;
    case SocialSection::Blocked:
        LoadBlockedUsers();
        break;
    case SocialSection::Profile:
        sectionPresenter_->ShowCurrentSection();
        sectionPresenter_->SyncProfileControls();
        break;
    }

}

void SocialFrame::UpdateStatus(const wxString& message, bool isError)
{
    if (view_->statusLabel == nullptr)
    {
        return;
    }

    view_->statusLabel->SetLabel(message);
    view_->statusLabel->SetForegroundColour(isError ? wxColour(255, 170, 170) : lila::shared::ui::Theme::Accent());
    view_->statusLabel->Wrap(GetClientSize().GetWidth() - 80);
    view_->statusLabel->GetParent()->Layout();
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleStatus(*view_->statusLabel, message);
}

void SocialFrame::RefreshCurrentSection()
{
    if (navigationState_.currentScreen == Screen::Section)
    {
        RefreshSection(navigationState_.currentSection);
    }
}

void SocialFrame::RefreshSection(SocialSection section)
{
    switch (section)
    {
    case SocialSection::Friends:
        LoadFriends();
        return;
    case SocialSection::IncomingRequests:
        LoadIncomingRequests();
        return;
    case SocialSection::OutgoingRequests:
        LoadOutgoingRequests();
        return;
    case SocialSection::Blocked:
        LoadBlockedUsers();
        return;
    case SocialSection::Profile:
        LoadProfile(navigationState_.profileTargetUserId);
        return;
    }
}

void SocialFrame::LoadFriends()
{
    auto snapshot = std::make_shared<SocialLoadController::FriendsSnapshot>();
    auto* loader = loadController_.get();
    RunBackgroundTask(
        lila::shared::text::FromUtf8(lila::shared::errors::SocialLoadFriendsBusy),
        [loader, snapshot]()
        {
            *snapshot = loader->LoadFriends();
        },
        [this, snapshot]()
        {
            dataStore_.ReplaceFriends(std::move(snapshot->friends), std::move(snapshot->blockedUsers));
            const auto& friends = dataStore_.Friends();
            sectionPresenter_->PopulateSection(SocialSection::Friends);

            sectionPresenter_->ShowCurrentSection();
            sectionPresenter_->SyncSelectionState();
            UpdateStatus(SocialPresentationModel::BuildSectionStatus(SocialSection::Friends, friends.size()));
            if (navigationState_.currentSection == SocialSection::Friends)
            {
                focusController_->FocusCurrentScreen();
            }
        });
}

void SocialFrame::LoadIncomingRequests()
{
    auto snapshot = std::make_shared<SocialLoadController::RequestsSnapshot>();
    auto* loader = loadController_.get();
    RunBackgroundTask(
        lila::shared::text::FromUtf8(lila::shared::errors::SocialLoadIncomingRequestsBusy),
        [loader, snapshot]()
        {
            *snapshot = loader->LoadIncomingRequests();
        },
        [this, snapshot]()
        {
            dataStore_.ReplaceIncomingRequests(std::move(snapshot->requests), std::move(snapshot->blockedUsers));
            const auto& requests = dataStore_.IncomingRequests();
            sectionPresenter_->PopulateSection(SocialSection::IncomingRequests);

            sectionPresenter_->ShowCurrentSection();
            sectionPresenter_->SyncSelectionState();
            UpdateStatus(SocialPresentationModel::BuildSectionStatus(SocialSection::IncomingRequests, requests.size()));
            if (navigationState_.currentSection == SocialSection::IncomingRequests)
            {
                focusController_->FocusCurrentScreen();
            }
        });
}

void SocialFrame::LoadOutgoingRequests()
{
    auto snapshot = std::make_shared<SocialLoadController::RequestsSnapshot>();
    auto* loader = loadController_.get();
    RunBackgroundTask(
        lila::shared::text::FromUtf8(lila::shared::errors::SocialLoadOutgoingRequestsBusy),
        [loader, snapshot]()
        {
            *snapshot = loader->LoadOutgoingRequests();
        },
        [this, snapshot]()
        {
            dataStore_.ReplaceOutgoingRequests(std::move(snapshot->requests), std::move(snapshot->blockedUsers));
            const auto& requests = dataStore_.OutgoingRequests();
            sectionPresenter_->PopulateSection(SocialSection::OutgoingRequests);

            sectionPresenter_->ShowCurrentSection();
            sectionPresenter_->SyncSelectionState();
            UpdateStatus(SocialPresentationModel::BuildSectionStatus(SocialSection::OutgoingRequests, requests.size()));
            if (navigationState_.currentSection == SocialSection::OutgoingRequests)
            {
                focusController_->FocusCurrentScreen();
            }
        });
}

void SocialFrame::LoadBlockedUsers()
{
    auto results = std::make_shared<std::vector<domain::SocialUser>>();
    auto* loader = loadController_.get();
    RunBackgroundTask(
        lila::shared::text::FromUtf8(lila::shared::errors::SocialLoadBlockedUsersBusy),
        [loader, results]()
        {
            *results = loader->LoadBlockedUsers();
        },
        [this, results]()
        {
            dataStore_.ReplaceBlockedUsers(std::move(*results));
            const auto& blockedUsers = dataStore_.BlockedUsers();
            sectionPresenter_->PopulateSection(SocialSection::Blocked);

            sectionPresenter_->ShowCurrentSection();
            sectionPresenter_->SyncSelectionState();
            UpdateStatus(SocialPresentationModel::BuildSectionStatus(SocialSection::Blocked, blockedUsers.size()));
            if (navigationState_.currentSection == SocialSection::Blocked)
            {
                focusController_->FocusCurrentScreen();
            }
        });
}

void SocialFrame::LoadProfile(std::optional<int> userId)
{
    navigationState_.BeginProfile(userId);
    auto result = std::make_shared<std::optional<domain::SocialProfile>>();
    auto* loader = loadController_.get();
    RunBackgroundTask(
        lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileLoading),
        [loader, result, userId]()
        {
            *result = loader->LoadProfile(userId);
        },
        [this, result]()
        {
            dataStore_.ReplaceProfile(std::move(*result));
            sectionPresenter_->ShowCurrentSection();
            sectionPresenter_->SyncProfileControls();

            const auto& profile = dataStore_.Profile();
            if (!profile.has_value())
            {
                UpdateStatus(lila::shared::text::FromUtf8(kProfileUnavailableStatus), true);
                return;
            }

            view_->profileTitleLabel->SetLabel(profile->isOwner
                ? lila::shared::text::FromUtf8(lila::shared::errors::SocialMenuProfile)
                : lila::shared::text::FromUtf8(profile->user.username));

            UpdateStatus(lila::shared::text::FromUtf8(
                !profile->isOwner && !profile->canView
                    ? lila::shared::errors::SocialProfilePrivate
                    : lila::shared::errors::SocialProfileLoaded));

            if (navigationState_.currentSection == SocialSection::Profile)
            {
                focusController_->FocusCurrentScreen();
            }
        });
}

void SocialFrame::OpenProfile(int userId)
{
    navigationState_.RememberProfileReturnSection();
    LoadProfile(userId);
    SetSection(SocialSection::Profile);
}

void SocialFrame::SaveProfile()
{
    const auto& currentProfile = dataStore_.Profile();
    if (!currentProfile.has_value() || !currentProfile->isOwner)
    {
        UpdateStatus(lila::shared::text::FromUtf8(lila::shared::errors::SocialOnlyOwnProfileEditable), true);
        return;
    }

    const domain::SocialProfileUpdate update = SocialProfileMapper::BuildUpdate(
        lila::shared::text::ToUtf8(view_->profileBioCtrl->GetValue()),
        lila::shared::text::ToUtf8(view_->profileVictoryCtrl->GetValue()),
        lila::shared::text::ToUtf8(view_->profileDefeatCtrl->GetValue()),
        view_->profileVisibilityChoice->GetSelection());

    actionController_->SaveProfile(
        update,
        [this](std::optional<domain::SocialProfile> savedProfile)
        {
            dataStore_.ReplaceProfile(std::move(savedProfile));
            navigationState_.profileEditorMode = ProfileEditorMode::Menu;
            sectionPresenter_->SyncProfileControls();
            ShowActionFeedback(lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileUpdated));
            if (navigationState_.currentSection == SocialSection::Profile)
            {
                focusController_->FocusCurrentScreen();
            }
        });
}

void SocialFrame::StartProfileEdit(ProfileEditorMode mode)
{
    navigationState_.profileEditorMode = mode;
    sectionPresenter_->SyncProfileControls();
    focusController_->FocusCurrentScreen();
}

void SocialFrame::ExitProfileEditMode()
{
    navigationState_.profileEditorMode = ProfileEditorMode::Menu;
    sectionPresenter_->SyncProfileEditorVisibility();
    if (view_->profileMenu != nullptr)
    {
        view_->profileMenu->FocusSelectedItem();
    }
    sectionPresenter_->SyncProfileControls();
}

bool SocialFrame::TryExitProfile()
{
    if (navigationState_.profileEditorMode != ProfileEditorMode::Menu)
    {
        ExitProfileEditMode();
        return true;
    }

    if (navigationState_.returnSectionFromProfile.has_value())
    {
        const SocialSection section = *navigationState_.returnSectionFromProfile;
        navigationState_.returnSectionFromProfile.reset();
        navigationState_.profileTargetUserId.reset();
        SetSection(section);
        return true;
    }

    return false;
}



}
