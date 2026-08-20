#pragma once

#include <cstddef>
#include <optional>

#include "modules/social/presentation/SocialSection.h"
#include "shared/ui/navigation/NavigationStack.h"

namespace lila::modules::social::presentation
{
class SocialNavigationState final
{
public:
    enum class Screen
    {
        Menu,
        Section,
    };

    enum class ProfileEditorMode
    {
        Menu,
        Bio,
        VictoryMessage,
        DefeatMessage,
        Visibility,
    };

    struct Snapshot final
    {
        Screen currentScreen;
        SocialSection currentSection;
        bool sectionActionMenuActive;
        ProfileEditorMode profileEditorMode;
        std::optional<int> profileTargetUserId;
        std::size_t lastMenuIndex;
    };

    explicit SocialNavigationState(std::size_t initialMenuIndex = 0) noexcept
        : lastMenuIndex(initialMenuIndex)
    {
    }

    void EnterMenu() noexcept
    {
        currentScreen = Screen::Menu;
        sectionActionMenuActive = false;
    }

    void EnterSection(SocialSection section, std::size_t menuIndex) noexcept
    {
        currentSection = section;
        lastMenuIndex = menuIndex;
        currentScreen = Screen::Section;
        sectionActionMenuActive = false;
    }

    void BeginProfile(std::optional<int> userId) noexcept
    {
        profileTargetUserId = userId;
        profileEditorMode = ProfileEditorMode::Menu;
    }

    void PushCurrent()
    {
        navigationHistory_.Push(Capture());
    }

    [[nodiscard]] bool CanGoBack() const noexcept
    {
        return !navigationHistory_.Empty();
    }

    [[nodiscard]] bool GoBack() noexcept
    {
        if (navigationHistory_.Empty())
        {
            return false;
        }

        Restore(navigationHistory_.Pop());
        return true;
    }

    [[nodiscard]] Snapshot Capture() const noexcept
    {
        return Snapshot{
            currentScreen,
            currentSection,
            sectionActionMenuActive,
            profileEditorMode,
            profileTargetUserId,
            lastMenuIndex,
        };
    }

    Screen currentScreen = Screen::Menu;
    SocialSection currentSection = SocialSection::Friends;
    bool sectionActionMenuActive = false;
    ProfileEditorMode profileEditorMode = ProfileEditorMode::Menu;
    std::optional<int> profileTargetUserId;
    std::size_t lastMenuIndex = 0;

private:
    void Restore(const Snapshot& snapshot) noexcept
    {
        currentScreen = snapshot.currentScreen;
        currentSection = snapshot.currentSection;
        sectionActionMenuActive = snapshot.sectionActionMenuActive;
        profileEditorMode = snapshot.profileEditorMode;
        profileTargetUserId = snapshot.profileTargetUserId;
        lastMenuIndex = snapshot.lastMenuIndex;
    }

    lila::shared::ui::navigation::NavigationStack<Snapshot> navigationHistory_;
};
}
