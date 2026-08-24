#include "modules/social/presentation/SocialScreenCoordinator.h"

#include <utility>

#include "modules/social/presentation/SocialSectionCoordinator.h"
#include "modules/social/presentation/SocialSectionPresenter.h"
#include "modules/social/presentation/SocialPresentationModel.h"
#include "modules/social/presentation/SocialView.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::social::presentation
{
SocialScreenCoordinator::SocialScreenCoordinator(
    SocialNavigationState& navigationState,
    SocialSectionCoordinator& sectionCoordinator,
    SocialSectionPresenter& sectionPresenter,
    SocialView& view,
    Callbacks callbacks) noexcept
    : navigationState_(navigationState),
      sectionCoordinator_(sectionCoordinator),
      sectionPresenter_(sectionPresenter),
      view_(view),
      callbacks_(std::move(callbacks))
{
}

void SocialScreenCoordinator::SetScreen(Screen screen)
{
    if (screen == Screen::Menu)
    {
        navigationState_.EnterMenu();
    }
    else
    {
        navigationState_.currentScreen = screen;
    }

    if (screen == Screen::Menu && view_.menu != nullptr)
    {
        view_.menu->SetSelectedIndexSilently(navigationState_.lastMenuIndex);
    }

    callbacks_.syncPanels();
    callbacks_.scheduleFocusCurrentScreen();
}

void SocialScreenCoordinator::ApplyNavigationState()
{
    if (navigationState_.currentScreen == Screen::Menu)
    {
        SetScreen(Screen::Menu);
        return;
    }

    if (view_.menu != nullptr)
    {
        view_.menu->SetSelectedIndexSilently(navigationState_.lastMenuIndex);
    }

    callbacks_.syncPanels();
    callbacks_.scheduleFocusCurrentScreen();
}

void SocialScreenCoordinator::ActivateMenuIndex(std::size_t index)
{
    navigationState_.lastMenuIndex = index;
    if (index == 0)
    {
        if (callbacks_.openMessagingRequested)
        {
            callbacks_.openMessagingRequested(navigationState_.lastMenuIndex);
        }
        return;
    }

    const auto section = SocialPresentationModel::MenuIndexToSection(index);
    if (!section.has_value())
    {
        return;
    }

    if (*section == SocialSection::Profile)
    {
        sectionCoordinator_.OpenOwnProfile();
        return;
    }

    navigationState_.PushCurrent();
    sectionCoordinator_.ActivateSection(*section);
}

void SocialScreenCoordinator::OpenCurrentSectionActionMenu()
{
    if (navigationState_.currentScreen != Screen::Section ||
        navigationState_.currentSection == SocialSection::Profile)
    {
        return;
    }

    navigationState_.sectionActionMenuActive = true;
    sectionPresenter_.SyncSelectionState();
    callbacks_.scheduleFocusCurrentScreen();
}

void SocialScreenCoordinator::CloseCurrentSectionActionMenu()
{
    if (!navigationState_.sectionActionMenuActive)
    {
        return;
    }

    navigationState_.sectionActionMenuActive = false;
    sectionPresenter_.SyncSelectionState();
    callbacks_.scheduleFocusCurrentScreen();
}

void SocialScreenCoordinator::HandleEscape()
{
    if (navigationState_.GoBack())
    {
        ApplyNavigationState();
        return;
    }

    if (callbacks_.closeRequested)
    {
        callbacks_.closeRequested();
    }
}
}
