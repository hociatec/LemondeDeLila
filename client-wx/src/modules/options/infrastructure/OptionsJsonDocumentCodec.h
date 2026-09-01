#pragma once

#include "modules/options/domain/OptionsState.h"

#include <nlohmann/json.hpp>

#include <string_view>

namespace lila::modules::options::infrastructure::json
{
namespace keys
{
inline constexpr std::string_view SchemaVersion = "schemaVersion";
inline constexpr std::string_view CurrentVersion = "currentVersion";

inline constexpr std::string_view General = "general";
inline constexpr std::string_view Audio = "audio";
inline constexpr std::string_view Chat = "chat";
inline constexpr std::string_view Admin = "admin";
inline constexpr std::string_view Internal = "internal";
inline constexpr std::string_view Runtime = "runtime";

inline constexpr std::string_view RestoreSessionOnStartup = "restoreSessionOnStartup";
inline constexpr std::string_view ShowNavigationStatus = "showNavigationStatus";
inline constexpr std::string_view MuteAll = "muteAll";
inline constexpr std::string_view ConfirmExit = "confirmExit";
inline constexpr std::string_view RepairBrokenAccents = "repairBrokenAccents";
inline constexpr std::string_view EnableBetaGames = "enableBetaGames";
inline constexpr std::string_view SoundAmbience = "soundAmbience";
inline constexpr std::string_view SoundAppLaunch = "soundAppLaunch";
inline constexpr std::string_view SoundNavigate = "soundNavigate";
inline constexpr std::string_view SoundSelect = "soundSelect";
inline constexpr std::string_view SoundChatMessages = "soundChatMessages";
inline constexpr std::string_view SoundTableAmbience = "soundTableAmbience";
inline constexpr std::string_view SoundAmbienceVolume = "soundAmbienceVolume";
inline constexpr std::string_view SoundAmbienceSplit = "soundAmbienceSplit";
inline constexpr std::string_view SoundMenuAmbienceVolume = "soundMenuAmbienceVolume";
inline constexpr std::string_view SoundTavernAmbienceVolume = "soundTavernAmbienceVolume";
inline constexpr std::string_view SoundAppLaunchVolume = "soundAppLaunchVolume";
inline constexpr std::string_view SoundNavigateVolume = "soundNavigateVolume";
inline constexpr std::string_view SoundSelectVolume = "soundSelectVolume";
inline constexpr std::string_view SoundChatMessagesVolume = "soundChatMessagesVolume";
inline constexpr std::string_view SoundTableAmbienceVolume = "soundTableAmbienceVolume";
inline constexpr std::string_view SoundCues = "cues";
inline constexpr std::string_view Enabled = "enabled";
inline constexpr std::string_view Volume = "volume";
inline constexpr std::string_view ChatEnabled = "chatEnabled";
inline constexpr std::string_view ConfirmChatExit = "confirmChatExit";
inline constexpr std::string_view AdminChatModerationLoadLimit = "adminChatModerationLoadLimit";
}

[[nodiscard]] domain::OptionsState Parse(const nlohmann::json& document);
[[nodiscard]] nlohmann::json Serialize(const domain::OptionsState& state);
}
