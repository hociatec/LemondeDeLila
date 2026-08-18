#pragma once

#include <string>
#include <algorithm>

namespace lila::modules::options::domain
{
struct OptionsState final
{
    static constexpr int MinimumVolume = 0;
    static constexpr int MaximumVolume = 100;
    static constexpr int MinimumModerationLoadLimit = 1;
    static constexpr int MaximumModerationLoadLimit = 1000;

    bool restoreSessionOnStartup = true;
    bool showNavigationStatus = true;

    bool muteAll = false;
    bool confirmExit = false;
    bool enableBetaGames = false;

    bool soundAmbience = true;
    bool soundAppLaunch = true;
    bool soundNavigate = true;
    bool soundSelect = true;
    bool soundChatMessages = true;
    bool soundTableAmbience = true;

    int soundAmbienceVolume = 25;
    bool soundAmbienceSplit = false;
    int soundMenuAmbienceVolume = 25;
    int soundTavernAmbienceVolume = 25;
    int soundAppLaunchVolume = 50;
    int soundNavigateVolume = 50;
    int soundSelectVolume = 50;
    int soundChatMessagesVolume = 50;
    int soundTableAmbienceVolume = 15;

    bool chatEnabled = true;
    bool confirmChatExit = false;
    int adminChatModerationLoadLimit = 200;

    std::string currentVersion = "unknown";

    [[nodiscard]] bool operator==(const OptionsState&) const = default;

    void Normalize()
    {
        soundAmbienceVolume = std::clamp(soundAmbienceVolume, MinimumVolume, MaximumVolume);
        soundMenuAmbienceVolume = std::clamp(soundMenuAmbienceVolume, MinimumVolume, MaximumVolume);
        soundTavernAmbienceVolume = std::clamp(soundTavernAmbienceVolume, MinimumVolume, MaximumVolume);
        soundAppLaunchVolume = std::clamp(soundAppLaunchVolume, MinimumVolume, MaximumVolume);
        soundNavigateVolume = std::clamp(soundNavigateVolume, MinimumVolume, MaximumVolume);
        soundSelectVolume = std::clamp(soundSelectVolume, MinimumVolume, MaximumVolume);
        soundChatMessagesVolume = std::clamp(soundChatMessagesVolume, MinimumVolume, MaximumVolume);
        soundTableAmbienceVolume = std::clamp(soundTableAmbienceVolume, MinimumVolume, MaximumVolume);
        adminChatModerationLoadLimit = std::clamp(
            adminChatModerationLoadLimit,
            MinimumModerationLoadLimit,
            MaximumModerationLoadLimit);
        if (currentVersion.empty())
        {
            currentVersion = "unknown";
        }
    }
};
}
