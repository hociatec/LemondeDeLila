#pragma once

#include <cstddef>
#include <functional>

#include "modules/social/presentation/SocialNavigationState.h"
#include "modules/social/presentation/SocialSection.h"

namespace lila::modules::social::presentation
{
class SocialSectionCoordinator;
class SocialSectionPresenter;
class SocialView;

class SocialScreenCoordinator final
{
public:
    using Screen = SocialNavigationState::Screen;

    struct Callbacks final
    {
        std::function<void(std::size_t)> openMessagingRequested;
        std::function<void()> closeRequested;
        std::function<void()> syncPanels;
        std::function<void()> scheduleFocusCurrentScreen;
    };

    SocialScreenCoordinator(
        SocialNavigationState& navigationState,
        SocialSectionCoordinator& sectionCoordinator,
        SocialSectionPresenter& sectionPresenter,
        SocialView& view,
        Callbacks callbacks) noexcept;

    void SetScreen(Screen screen);
    void ApplyNavigationState();
    void ActivateMenuIndex(std::size_t index);
    void OpenCurrentSectionActionMenu();
    void CloseCurrentSectionActionMenu();
    void HandleEscape();

private:
    SocialNavigationState& navigationState_;
    SocialSectionCoordinator& sectionCoordinator_;
    SocialSectionPresenter& sectionPresenter_;
    SocialView& view_;
    Callbacks callbacks_;
};
}
