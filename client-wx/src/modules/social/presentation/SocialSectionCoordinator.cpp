#include "shared/text/Encoding.h"
#include "modules/social/presentation/SocialSectionCoordinator.h"

#include <memory>
#include <optional>
#include <utility>
#include <vector>

#include <wx/stattext.h>

#include "modules/social/domain/SocialProfile.h"
#include "modules/social/domain/SocialUser.h"
#include "modules/social/presentation/SocialDataStore.h"
#include "modules/social/presentation/SocialLoadController.h"
#include "modules/social/presentation/SocialNavigationState.h"
#include "modules/social/presentation/SocialPresentationModel.h"
#include "modules/social/presentation/SocialSectionPresenter.h"
#include "modules/social/presentation/SocialView.h"
#include "shared/text/UiTexts.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::social::presentation
{
namespace
{
const auto kProfileUnavailableStatus = lila::shared::text::ui::SocialProfileUnavailable;
}

SocialSectionCoordinator::SocialSectionCoordinator(
    SocialLoadController& loadController,
    SocialDataStore& dataStore,
    SocialNavigationState& navigationState,
    SocialSectionPresenter& sectionPresenter,
    SocialView& view,
    Callbacks callbacks) noexcept
    : loadController_(loadController),
      dataStore_(dataStore),
      navigationState_(navigationState),
      sectionPresenter_(sectionPresenter),
      view_(view),
      callbacks_(std::move(callbacks))
{
}

void SocialSectionCoordinator::ActivateSection(SocialSection section)
{
    if (section != navigationState_.currentSection)
    {
        sectionPresenter_.StoreSelection(navigationState_.currentSection);
    }

    navigationState_.EnterSection(section, SocialPresentationModel::SectionToMenuIndex(section));
    if (view_.menu != nullptr)
    {
        view_.menu->SetSelectedIndexSilently(navigationState_.lastMenuIndex);
    }

    if (section == SocialSection::Profile)
    {
        sectionPresenter_.ShowCurrentSection();
        sectionPresenter_.SyncProfileControls();
        return;
    }

    sectionPresenter_.ShowCurrentSection();
    sectionPresenter_.SyncSectionActionVisibility();
    RefreshSection(section);
}

void SocialSectionCoordinator::RefreshSection(SocialSection section)
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

void SocialSectionCoordinator::RefreshCurrentSection()
{
    if (navigationState_.currentScreen == SocialNavigationState::Screen::Section)
    {
        RefreshSection(navigationState_.currentSection);
    }
}

void SocialSectionCoordinator::OpenProfile(int userId)
{
    navigationState_.PushCurrent();
    ActivateSection(SocialSection::Profile);
    LoadProfile(userId);
}

void SocialSectionCoordinator::OpenOwnProfile()
{
    navigationState_.PushCurrent();
    ActivateSection(SocialSection::Profile);
    LoadProfile(std::nullopt);
}

void SocialSectionCoordinator::LoadFriends()
{
    auto snapshot = std::make_shared<SocialLoadController::FriendsSnapshot>();
    callbacks_.runBackgroundTask(
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialLoadFriendsBusy),
        [this, snapshot]()
        {
            *snapshot = loadController_.LoadFriends();
        },
        [this, snapshot]()
        {
            dataStore_.ReplaceFriends(std::move(snapshot->friends), std::move(snapshot->blockedUsers));
            sectionPresenter_.PopulateSection(SocialSection::Friends);
            sectionPresenter_.ShowCurrentSection();
            sectionPresenter_.SyncSelectionState();
            callbacks_.updateStatus(
                SocialPresentationModel::BuildSectionStatus(SocialSection::Friends, dataStore_.Friends().size()),
                false);
            FocusSectionIfVisible(SocialSection::Friends);
        });
}

void SocialSectionCoordinator::LoadIncomingRequests()
{
    auto snapshot = std::make_shared<SocialLoadController::RequestsSnapshot>();
    callbacks_.runBackgroundTask(
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialLoadIncomingRequestsBusy),
        [this, snapshot]()
        {
            *snapshot = loadController_.LoadIncomingRequests();
        },
        [this, snapshot]()
        {
            dataStore_.ReplaceIncomingRequests(std::move(snapshot->requests), std::move(snapshot->blockedUsers));
            sectionPresenter_.PopulateSection(SocialSection::IncomingRequests);
            sectionPresenter_.ShowCurrentSection();
            sectionPresenter_.SyncSelectionState();
            callbacks_.updateStatus(
                SocialPresentationModel::BuildSectionStatus(
                    SocialSection::IncomingRequests,
                    dataStore_.IncomingRequests().size()),
                false);
            FocusSectionIfVisible(SocialSection::IncomingRequests);
        });
}

void SocialSectionCoordinator::LoadOutgoingRequests()
{
    auto snapshot = std::make_shared<SocialLoadController::RequestsSnapshot>();
    callbacks_.runBackgroundTask(
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialLoadOutgoingRequestsBusy),
        [this, snapshot]()
        {
            *snapshot = loadController_.LoadOutgoingRequests();
        },
        [this, snapshot]()
        {
            dataStore_.ReplaceOutgoingRequests(std::move(snapshot->requests), std::move(snapshot->blockedUsers));
            sectionPresenter_.PopulateSection(SocialSection::OutgoingRequests);
            sectionPresenter_.ShowCurrentSection();
            sectionPresenter_.SyncSelectionState();
            callbacks_.updateStatus(
                SocialPresentationModel::BuildSectionStatus(
                    SocialSection::OutgoingRequests,
                    dataStore_.OutgoingRequests().size()),
                false);
            FocusSectionIfVisible(SocialSection::OutgoingRequests);
        });
}

void SocialSectionCoordinator::LoadBlockedUsers()
{
    auto results = std::make_shared<std::vector<domain::SocialUser>>();
    callbacks_.runBackgroundTask(
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialLoadBlockedUsersBusy),
        [this, results]()
        {
            *results = loadController_.LoadBlockedUsers();
        },
        [this, results]()
        {
            dataStore_.ReplaceBlockedUsers(std::move(*results));
            sectionPresenter_.PopulateSection(SocialSection::Blocked);
            sectionPresenter_.ShowCurrentSection();
            sectionPresenter_.SyncSelectionState();
            callbacks_.updateStatus(
                SocialPresentationModel::BuildSectionStatus(SocialSection::Blocked, dataStore_.BlockedUsers().size()),
                false);
            FocusSectionIfVisible(SocialSection::Blocked);
        });
}

void SocialSectionCoordinator::LoadProfile(std::optional<int> userId)
{
    navigationState_.BeginProfile(userId);
    auto result = std::make_shared<std::optional<domain::SocialProfile>>();
    callbacks_.runBackgroundTask(
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileLoading),
        [this, result, userId]()
        {
            *result = loadController_.LoadProfile(userId);
        },
        [this, result]()
        {
            dataStore_.ReplaceProfile(std::move(*result));
            sectionPresenter_.ShowCurrentSection();
            sectionPresenter_.SyncProfileControls();

            if (!dataStore_.Profile().has_value())
            {
                callbacks_.updateStatus(lila::shared::text::FromUtf8(kProfileUnavailableStatus), true);
                return;
            }

            ApplyProfileTitle();
            callbacks_.updateStatus(
                lila::shared::text::FromUtf8(
                    !dataStore_.Profile()->isOwner && !dataStore_.Profile()->canView
                        ? lila::shared::text::ui::SocialProfilePrivate
                        : lila::shared::text::ui::SocialProfileLoaded),
                false);
            FocusSectionIfVisible(SocialSection::Profile);
        });
}

void SocialSectionCoordinator::FocusSectionIfVisible(SocialSection section) const
{
    if (navigationState_.currentSection == section)
    {
        callbacks_.focusCurrentScreen();
    }
}

void SocialSectionCoordinator::ApplyProfileTitle() const
{
    if (view_.profileTitleLabel == nullptr || !dataStore_.Profile().has_value())
    {
        return;
    }

    const auto& profile = *dataStore_.Profile();
    view_.profileTitleLabel->SetLabel(profile.isOwner
        ? lila::shared::text::FromUtf8(lila::shared::text::ui::SocialMenuProfile)
        : lila::shared::text::FromUtf8(profile.user.username));
}
}
