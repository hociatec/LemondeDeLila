#include "modules/social/presentation/SocialSectionCoordinator.h"

#include <utility>

#include "modules/social/presentation/SocialNavigationState.h"
#include "modules/social/presentation/SocialPresentationModel.h"
#include "modules/social/presentation/SocialSectionPresenter.h"
#include "modules/social/presentation/SocialView.h"
#include "shared/text/presentation/catalog/UiTexts.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::social::presentation
{
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
}
