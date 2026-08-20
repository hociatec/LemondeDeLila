#include "shared/text/Encoding.h"
#include "modules/social/presentation/SocialFrame.h"
#include "modules/social/presentation/SocialFocusController.h"
#include "modules/social/presentation/SocialLoadController.h"
#include "modules/social/presentation/SocialSectionPresenter.h"
#include "modules/social/presentation/SocialView.h"

#include <memory>
#include <string>

#include <wx/stattext.h>

#include "shared/text/UiTexts.h"

namespace lila::modules::social::presentation
{
namespace
{
const auto kProfileUnavailableStatus = lila::shared::text::ui::SocialProfileUnavailable;
}

void SocialFrame::LoadFriends()
{
    auto snapshot = std::make_shared<SocialLoadController::FriendsSnapshot>();
    auto* loader = loadController_.get();
    RunBackgroundTask(
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialLoadFriendsBusy),
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
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialLoadIncomingRequestsBusy),
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
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialLoadOutgoingRequestsBusy),
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
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialLoadBlockedUsersBusy),
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
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileLoading),
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
                ? lila::shared::text::FromUtf8(lila::shared::text::ui::SocialMenuProfile)
                : lila::shared::text::FromUtf8(profile->user.username));

            UpdateStatus(lila::shared::text::FromUtf8(
                !profile->isOwner && !profile->canView
                    ? lila::shared::text::ui::SocialProfilePrivate
                    : lila::shared::text::ui::SocialProfileLoaded));

            if (navigationState_.currentSection == SocialSection::Profile)
            {
                focusController_->FocusCurrentScreen();
            }
        });
}
}
