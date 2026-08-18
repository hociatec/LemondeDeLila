#pragma once

#include <cstddef>
#include <optional>

#include "modules/social/presentation/SocialSection.h"

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

    explicit SocialNavigationState(std::size_t initialMenuIndex = 0) noexcept
        : lastMenuIndex(initialMenuIndex)
    {
    }

    void EnterMenu() noexcept
    {
        currentScreen = Screen::Menu;
    }

    void EnterSection(SocialSection section, std::size_t menuIndex) noexcept
    {
        currentSection = section;
        lastMenuIndex = menuIndex;
        currentScreen = Screen::Section;
    }

    void BeginProfile(std::optional<int> userId) noexcept
    {
        profileTargetUserId = userId;
        profileEditorMode = ProfileEditorMode::Menu;
    }

    void RememberProfileReturnSection() noexcept
    {
        returnSectionFromProfile = currentSection;
    }

    void ResetProfileNavigation() noexcept
    {
        profileEditorMode = ProfileEditorMode::Menu;
        profileTargetUserId.reset();
        returnSectionFromProfile.reset();
    }

    Screen currentScreen = Screen::Menu;
    SocialSection currentSection = SocialSection::Friends;
    ProfileEditorMode profileEditorMode = ProfileEditorMode::Menu;
    std::optional<SocialSection> returnSectionFromProfile;
    std::optional<int> profileTargetUserId;
    std::size_t lastMenuIndex = 0;
};
}
