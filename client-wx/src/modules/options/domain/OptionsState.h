#pragma once

#include <string>
#include <algorithm>
#include <optional>

namespace lila::modules::options::domain
{
struct AudioOptions
{
    bool muteAll = false;
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

    [[nodiscard]] bool operator==(const AudioOptions&) const = default;
};

struct ChatOptions
{
    bool chatEnabled = true;
    bool confirmChatExit = false;

    [[nodiscard]] bool operator==(const ChatOptions&) const = default;
};

struct AdminOptions
{
    int adminChatModerationLoadLimit = 200;

    [[nodiscard]] bool operator==(const AdminOptions&) const = default;
};

struct GeneralOptions
{
    bool restoreSessionOnStartup = true;
    bool showNavigationStatus = true;
    bool confirmExit = false;
    bool enableBetaGames = false;

    [[nodiscard]] bool operator==(const GeneralOptions&) const = default;
};

struct OptionsState final
{
    static constexpr int SchemaVersion = 2;
    static constexpr int MinimumVolume = 0;
    static constexpr int MaximumVolume = 100;
    static constexpr int MinimumModerationLoadLimit = 1;
    static constexpr int MaximumModerationLoadLimit = 1000;

    int schemaVersion = SchemaVersion;
    std::optional<std::string> currentVersion;

    GeneralOptions general;
    AudioOptions audio;
    ChatOptions chat;
    AdminOptions admin;

    // Flat direct fields forwarding to sub-structures for backward compatibility
    bool& restoreSessionOnStartup = general.restoreSessionOnStartup;
    bool& showNavigationStatus = general.showNavigationStatus;
    bool& muteAll = audio.muteAll;
    bool& confirmExit = general.confirmExit;
    bool& enableBetaGames = general.enableBetaGames;
    bool& soundAmbience = audio.soundAmbience;
    bool& soundAppLaunch = audio.soundAppLaunch;
    bool& soundNavigate = audio.soundNavigate;
    bool& soundSelect = audio.soundSelect;
    bool& soundChatMessages = audio.soundChatMessages;
    bool& soundTableAmbience = audio.soundTableAmbience;
    int& soundAmbienceVolume = audio.soundAmbienceVolume;
    bool& soundAmbienceSplit = audio.soundAmbienceSplit;
    int& soundMenuAmbienceVolume = audio.soundMenuAmbienceVolume;
    int& soundTavernAmbienceVolume = audio.soundTavernAmbienceVolume;
    int& soundAppLaunchVolume = audio.soundAppLaunchVolume;
    int& soundNavigateVolume = audio.soundNavigateVolume;
    int& soundSelectVolume = audio.soundSelectVolume;
    int& soundChatMessagesVolume = audio.soundChatMessagesVolume;
    int& soundTableAmbienceVolume = audio.soundTableAmbienceVolume;
    bool& chatEnabled = chat.chatEnabled;
    bool& confirmChatExit = chat.confirmChatExit;
    int& adminChatModerationLoadLimit = admin.adminChatModerationLoadLimit;

    OptionsState() = default;

    OptionsState(const OptionsState& other)
        : schemaVersion(other.schemaVersion),
          currentVersion(other.currentVersion),
          general(other.general),
          audio(other.audio),
          chat(other.chat),
          admin(other.admin)
    {
    }

    OptionsState& operator=(const OptionsState& other)
    {
        if (this != &other)
        {
            schemaVersion = other.schemaVersion;
            currentVersion = other.currentVersion;
            general = other.general;
            audio = other.audio;
            chat = other.chat;
            admin = other.admin;
        }
        return *this;
    }

    OptionsState(OptionsState&& other) noexcept
        : schemaVersion(other.schemaVersion),
          currentVersion(std::move(other.currentVersion)),
          general(std::move(other.general)),
          audio(std::move(other.audio)),
          chat(std::move(other.chat)),
          admin(std::move(other.admin))
    {
    }

    OptionsState& operator=(OptionsState&& other) noexcept
    {
        if (this != &other)
        {
            schemaVersion = other.schemaVersion;
            currentVersion = std::move(other.currentVersion);
            general = std::move(other.general);
            audio = std::move(other.audio);
            chat = std::move(other.chat);
            admin = std::move(other.admin);
        }
        return *this;
    }

    [[nodiscard]] bool operator==(const OptionsState& other) const
    {
        return schemaVersion == other.schemaVersion &&
               currentVersion == other.currentVersion &&
               general == other.general &&
               audio == other.audio &&
               chat == other.chat &&
               admin == other.admin;
    }

    void Normalize()
    {
        audio.soundAmbienceVolume = std::clamp(audio.soundAmbienceVolume, MinimumVolume, MaximumVolume);
        audio.soundMenuAmbienceVolume = std::clamp(audio.soundMenuAmbienceVolume, MinimumVolume, MaximumVolume);
        audio.soundTavernAmbienceVolume = std::clamp(audio.soundTavernAmbienceVolume, MinimumVolume, MaximumVolume);
        audio.soundAppLaunchVolume = std::clamp(audio.soundAppLaunchVolume, MinimumVolume, MaximumVolume);
        audio.soundNavigateVolume = std::clamp(audio.soundNavigateVolume, MinimumVolume, MaximumVolume);
        audio.soundSelectVolume = std::clamp(audio.soundSelectVolume, MinimumVolume, MaximumVolume);
        audio.soundChatMessagesVolume = std::clamp(audio.soundChatMessagesVolume, MinimumVolume, MaximumVolume);
        audio.soundTableAmbienceVolume = std::clamp(audio.soundTableAmbienceVolume, MinimumVolume, MaximumVolume);
        admin.adminChatModerationLoadLimit = std::clamp(
            admin.adminChatModerationLoadLimit,
            MinimumModerationLoadLimit,
            MaximumModerationLoadLimit);
    }
};
}
