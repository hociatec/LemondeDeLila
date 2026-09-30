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
#include "shared/text/presentation/catalog/UiTexts.h"
#include "shared/text/presentation/encoding/Encoding.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::social::presentation
{
namespace
{
const auto kProfileUnavailableStatus = lila::shared::text::ui::SocialProfileUnavailable;

template <typename Result, typename Worker, typename Apply>
void RunSectionLoad(
    SocialSection section,
    const wxString& busyMessage,
    SocialSectionCoordinator::Callbacks& callbacks,
    Worker&& worker,
    Apply&& apply)
{
    auto result = std::make_shared<Result>();
    callbacks.runBackgroundTask(
        busyMessage,
        [result, worker = std::forward<Worker>(worker)]() mutable
        {
            *result = worker();
        },
        [section, result, callbacks = callbacks, apply = std::forward<Apply>(apply)]() mutable
        {
            apply(std::move(*result));
        },
        false);
}
}

void SocialSectionCoordinator::LoadFriends()
{
    const auto loadController = loadController_;
    RunSectionLoad<SocialLoadController::FriendsSnapshot>(
        SocialSection::Friends,
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialLoadFriendsBusy),
        callbacks_,
        [loadController]()
        {
            return loadController->LoadFriends();
        },
        [this](SocialLoadController::FriendsSnapshot snapshot)
        {
            dataStore_.ReplaceFriends(std::move(snapshot.friends), std::move(snapshot.blockedUsers));
            sectionPresenter_.PopulateSection(SocialSection::Friends);
            sectionPresenter_.ShowCurrentSection();
            sectionPresenter_.SyncSelectionState();
            callbacks_.updateStatus(
                SocialPresentationModel::BuildSectionStatus(SocialSection::Friends, dataStore_.Friends().size()),
                false,
                false);
            FocusSectionIfVisible(SocialSection::Friends);
        });
}

void SocialSectionCoordinator::LoadIncomingRequests()
{
    const auto loadController = loadController_;
    RunSectionLoad<SocialLoadController::RequestsSnapshot>(
        SocialSection::IncomingRequests,
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialLoadIncomingRequestsBusy),
        callbacks_,
        [loadController]()
        {
            return loadController->LoadIncomingRequests();
        },
        [this](SocialLoadController::RequestsSnapshot snapshot)
        {
            dataStore_.ReplaceIncomingRequests(std::move(snapshot.requests), std::move(snapshot.blockedUsers));
            sectionPresenter_.PopulateSection(SocialSection::IncomingRequests);
            sectionPresenter_.ShowCurrentSection();
            sectionPresenter_.SyncSelectionState();
            callbacks_.updateStatus(
                SocialPresentationModel::BuildSectionStatus(
                    SocialSection::IncomingRequests,
                    dataStore_.IncomingRequests().size()),
                false,
                false);
            FocusSectionIfVisible(SocialSection::IncomingRequests);
        });
}

void SocialSectionCoordinator::LoadOutgoingRequests()
{
    const auto loadController = loadController_;
    RunSectionLoad<SocialLoadController::RequestsSnapshot>(
        SocialSection::OutgoingRequests,
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialLoadOutgoingRequestsBusy),
        callbacks_,
        [loadController]()
        {
            return loadController->LoadOutgoingRequests();
        },
        [this](SocialLoadController::RequestsSnapshot snapshot)
        {
            dataStore_.ReplaceOutgoingRequests(std::move(snapshot.requests), std::move(snapshot.blockedUsers));
            sectionPresenter_.PopulateSection(SocialSection::OutgoingRequests);
            sectionPresenter_.ShowCurrentSection();
            sectionPresenter_.SyncSelectionState();
            callbacks_.updateStatus(
                SocialPresentationModel::BuildSectionStatus(
                    SocialSection::OutgoingRequests,
                    dataStore_.OutgoingRequests().size()),
                false,
                false);
            FocusSectionIfVisible(SocialSection::OutgoingRequests);
        });
}

void SocialSectionCoordinator::LoadBlockedUsers()
{
    const auto loadController = loadController_;
    RunSectionLoad<std::vector<domain::SocialUser>>(
        SocialSection::Blocked,
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialLoadBlockedUsersBusy),
        callbacks_,
        [loadController]()
        {
            return loadController->LoadBlockedUsers();
        },
        [this](std::vector<domain::SocialUser> results)
        {
            dataStore_.ReplaceBlockedUsers(std::move(results));
            sectionPresenter_.PopulateSection(SocialSection::Blocked);
            sectionPresenter_.ShowCurrentSection();
            sectionPresenter_.SyncSelectionState();
            callbacks_.updateStatus(
                SocialPresentationModel::BuildSectionStatus(SocialSection::Blocked, dataStore_.BlockedUsers().size()),
                false,
                false);
            FocusSectionIfVisible(SocialSection::Blocked);
        });
}

void SocialSectionCoordinator::LoadProfile(std::optional<int> userId)
{
    navigationState_.BeginProfile(userId);
    auto result = std::make_shared<std::optional<domain::SocialProfile>>();
    const auto loadController = loadController_;
    callbacks_.runBackgroundTask(
        lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileLoading),
        [loadController, result, userId]()
        {
            *result = loadController->LoadProfile(userId);
        },
        [this, result]()
        {
            dataStore_.ReplaceProfile(std::move(*result));
            sectionPresenter_.ShowCurrentSection();
            sectionPresenter_.SyncProfileControls();

            if (!dataStore_.Profile().has_value())
            {
                callbacks_.updateStatus(lila::shared::text::FromUtf8(kProfileUnavailableStatus), true, true);
                return;
            }

            ApplyProfileTitle();
            callbacks_.updateStatus(
                lila::shared::text::FromUtf8(
                    !dataStore_.Profile()->isOwner && !dataStore_.Profile()->canView
                        ? lila::shared::text::ui::SocialProfilePrivate
                        : lila::shared::text::ui::SocialProfileLoaded),
                false,
                false);
            FocusSectionIfVisible(SocialSection::Profile);
        },
        false);
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
