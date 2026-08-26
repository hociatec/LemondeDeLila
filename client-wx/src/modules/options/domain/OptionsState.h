#pragma once

#include <string>
#include <algorithm>
#include <map>
#include <optional>

namespace lila::modules::options::domain
{
struct SoundCueOptions final
{
    bool enabled = true;
    int volume = 100;

    [[nodiscard]] bool operator==(const SoundCueOptions&) const = default;
};

using SoundCueOptionsMap = std::map<std::string, SoundCueOptions, std::less<>>;

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
    SoundCueOptionsMap cues;

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

struct RuntimeOptions
{
    std::optional<std::string> currentVersion;

    [[nodiscard]] bool operator==(const RuntimeOptions&) const = default;
};

struct InternalOptions
{
    AdminOptions admin;

    [[nodiscard]] bool operator==(const InternalOptions&) const = default;
};

struct GeneralOptions
{
    bool restoreSessionOnStartup = true;
    bool showNavigationStatus = true;
    bool confirmExit = false;
    bool repairBrokenAccents = true;
    bool enableBetaGames = false;

    [[nodiscard]] bool operator==(const GeneralOptions&) const = default;
};

struct OptionsState final
{
    static constexpr int SchemaVersion = 5;
    static constexpr int MinimumVolume = 0;
    static constexpr int MaximumVolume = 100;
    static constexpr int MinimumModerationLoadLimit = 1;
    static constexpr int MaximumModerationLoadLimit = 1000;

    int schemaVersion = SchemaVersion;

    GeneralOptions general;
    AudioOptions audio;
    ChatOptions chat;
    InternalOptions internal;
    RuntimeOptions runtime;

    [[nodiscard]] bool operator==(const OptionsState&) const = default;

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
        for (auto& [key, cue] : audio.cues)
        {
            static_cast<void>(key);
            cue.volume = std::clamp(cue.volume, MinimumVolume, MaximumVolume);
        }
        internal.admin.adminChatModerationLoadLimit = std::clamp(
            internal.admin.adminChatModerationLoadLimit,
            MinimumModerationLoadLimit,
            MaximumModerationLoadLimit);
    }
};
}
