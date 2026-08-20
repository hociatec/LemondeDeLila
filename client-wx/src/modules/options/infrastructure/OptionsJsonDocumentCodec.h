#pragma once

#include "modules/options/domain/OptionsState.h"
#include "shared/data/JsonApiHelpers.h"
#include "shared/data/JsonReaders.h"
#include "shared/errors/ErrorMessages.h"

#include <nlohmann/json.hpp>

#include <stdexcept>
#include <string>
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
inline constexpr std::string_view LegacyConfirmLogout = "confirmLogout";
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
inline constexpr std::string_view ChatEnabled = "chatEnabled";
inline constexpr std::string_view ConfirmChatExit = "confirmChatExit";
inline constexpr std::string_view AdminChatModerationLoadLimit = "adminChatModerationLoadLimit";
}

namespace
{
bool HasObjectField(const nlohmann::json& document, std::string_view fieldName)
{
    const auto iterator = document.find(std::string(fieldName));
    return iterator != document.end() && iterator->is_object();
}

nlohmann::json BuildCurrentSchemaDocument(const nlohmann::json& legacyDocument)
{
    const auto readBool = [&legacyDocument](std::string_view key, bool fallback)
    {
        return lila::shared::data::json::ReadOptionalBool(legacyDocument, key.data(), fallback);
    };
    const auto readInt = [&legacyDocument](std::string_view key, int fallback)
    {
        return lila::shared::data::json::ReadOptionalInteger(legacyDocument, key.data(), fallback);
    };

    return nlohmann::json{
        {std::string(keys::SchemaVersion), domain::OptionsState::SchemaVersion},
        {std::string(keys::General), {
            {std::string(keys::RestoreSessionOnStartup), readBool(keys::RestoreSessionOnStartup, true)},
            {std::string(keys::ShowNavigationStatus), readBool(keys::ShowNavigationStatus, true)},
            {std::string(keys::ConfirmExit), lila::shared::data::json::ReadOptionalBool(
                legacyDocument,
                keys::ConfirmExit.data(),
                lila::shared::data::json::ReadOptionalBool(legacyDocument, keys::LegacyConfirmLogout.data(), false))},
            {std::string(keys::EnableBetaGames), readBool(keys::EnableBetaGames, false)},
        }},
        {std::string(keys::Audio), {
            {std::string(keys::MuteAll), readBool(keys::MuteAll, false)},
            {std::string(keys::SoundAmbience), readBool(keys::SoundAmbience, true)},
            {std::string(keys::SoundAppLaunch), readBool(keys::SoundAppLaunch, true)},
            {std::string(keys::SoundNavigate), readBool(keys::SoundNavigate, true)},
            {std::string(keys::SoundSelect), readBool(keys::SoundSelect, true)},
            {std::string(keys::SoundChatMessages), readBool(keys::SoundChatMessages, true)},
            {std::string(keys::SoundTableAmbience), readBool(keys::SoundTableAmbience, true)},
            {std::string(keys::SoundAmbienceVolume), readInt(keys::SoundAmbienceVolume, 25)},
            {std::string(keys::SoundAmbienceSplit), readBool(keys::SoundAmbienceSplit, false)},
            {std::string(keys::SoundMenuAmbienceVolume), readInt(keys::SoundMenuAmbienceVolume, 25)},
            {std::string(keys::SoundTavernAmbienceVolume), readInt(keys::SoundTavernAmbienceVolume, 25)},
            {std::string(keys::SoundAppLaunchVolume), readInt(keys::SoundAppLaunchVolume, 50)},
            {std::string(keys::SoundNavigateVolume), readInt(keys::SoundNavigateVolume, 50)},
            {std::string(keys::SoundSelectVolume), readInt(keys::SoundSelectVolume, 50)},
            {std::string(keys::SoundChatMessagesVolume), readInt(keys::SoundChatMessagesVolume, 50)},
            {std::string(keys::SoundTableAmbienceVolume), readInt(keys::SoundTableAmbienceVolume, 15)},
        }},
        {std::string(keys::Chat), {
            {std::string(keys::ChatEnabled), readBool(keys::ChatEnabled, true)},
            {std::string(keys::ConfirmChatExit), readBool(keys::ConfirmChatExit, false)},
        }},
        {std::string(keys::Admin), {
            {std::string(keys::AdminChatModerationLoadLimit), readInt(keys::AdminChatModerationLoadLimit, 200)},
        }},
        {std::string(keys::Internal), {
            {std::string(keys::Admin), {
                {std::string(keys::AdminChatModerationLoadLimit), readInt(keys::AdminChatModerationLoadLimit, 200)},
            }},
        }},
        {std::string(keys::Runtime), nlohmann::json::object()},
    };
}

nlohmann::json MigrateToCurrentSchema(const nlohmann::json& document)
{
    if (HasObjectField(document, keys::General) &&
        HasObjectField(document, keys::Audio) &&
        HasObjectField(document, keys::Chat) &&
        (HasObjectField(document, keys::Internal) || HasObjectField(document, keys::Admin)))
    {
        nlohmann::json migrated = document;
        if (!HasObjectField(migrated, keys::Internal) && HasObjectField(migrated, keys::Admin))
        {
            migrated[std::string(keys::Internal)] = {
                {std::string(keys::Admin), migrated.at(std::string(keys::Admin))}
            };
        }
        if (!HasObjectField(migrated, keys::Runtime))
        {
            migrated[std::string(keys::Runtime)] = nlohmann::json::object();
        }
        if (!HasObjectField(migrated, keys::Admin))
        {
            migrated[std::string(keys::Admin)] = migrated.at(std::string(keys::Internal)).at(std::string(keys::Admin));
        }
        migrated[std::string(keys::SchemaVersion)] = domain::OptionsState::SchemaVersion;
        const auto currentVersionIterator = migrated.find(std::string(keys::CurrentVersion));
        if (currentVersionIterator != migrated.end() && currentVersionIterator->is_string())
        {
            migrated[std::string(keys::Runtime)][std::string(keys::CurrentVersion)] = currentVersionIterator->get<std::string>();
        }
        return migrated;
    }

    nlohmann::json migrated = BuildCurrentSchemaDocument(document);
    const auto currentVersionIterator = document.find(std::string(keys::CurrentVersion));
    if (currentVersionIterator != document.end() && currentVersionIterator->is_string())
    {
        migrated[std::string(keys::CurrentVersion)] = currentVersionIterator->get<std::string>();
        migrated[std::string(keys::Runtime)][std::string(keys::CurrentVersion)] = currentVersionIterator->get<std::string>();
    }
    return migrated;
}
}

inline domain::OptionsState Parse(const nlohmann::json& document)
{
    if (!document.is_object())
    {
        throw std::runtime_error(lila::shared::errors::InvalidOptionsFile);
    }

    const nlohmann::json migrated = MigrateToCurrentSchema(document);
    const auto& general = lila::shared::data::json::ReadRequiredObjectStrict(
        migrated,
        keys::General.data(),
        lila::shared::errors::InvalidOptionsFile);
    const auto& audio = lila::shared::data::json::ReadRequiredObjectStrict(
        migrated,
        keys::Audio.data(),
        lila::shared::errors::InvalidOptionsFile);
    const auto& chat = lila::shared::data::json::ReadRequiredObjectStrict(
        migrated,
        keys::Chat.data(),
        lila::shared::errors::InvalidOptionsFile);
    const auto& internal = lila::shared::data::json::ReadRequiredObjectStrict(
        migrated,
        keys::Internal.data(),
        lila::shared::errors::InvalidOptionsFile);
    const auto& admin = lila::shared::data::json::ReadRequiredObjectStrict(
        internal,
        keys::Admin.data(),
        lila::shared::errors::InvalidOptionsFile);
    const auto& runtime = lila::shared::data::json::ReadRequiredObjectStrict(
        migrated,
        keys::Runtime.data(),
        lila::shared::errors::InvalidOptionsFile);

    domain::OptionsState state;
    state.schemaVersion = lila::shared::data::json::ReadOptionalInteger(
        migrated,
        keys::SchemaVersion.data(),
        domain::OptionsState::SchemaVersion);

    state.general.restoreSessionOnStartup = lila::shared::data::json::ReadOptionalBool(general, keys::RestoreSessionOnStartup.data(), state.general.restoreSessionOnStartup);
    state.general.showNavigationStatus = lila::shared::data::json::ReadOptionalBool(general, keys::ShowNavigationStatus.data(), state.general.showNavigationStatus);
    state.general.confirmExit = lila::shared::data::json::ReadOptionalBool(general, keys::ConfirmExit.data(), state.general.confirmExit);
    state.general.enableBetaGames = lila::shared::data::json::ReadOptionalBool(general, keys::EnableBetaGames.data(), state.general.enableBetaGames);

    state.audio.muteAll = lila::shared::data::json::ReadOptionalBool(audio, keys::MuteAll.data(), state.audio.muteAll);
    state.audio.soundAmbience = lila::shared::data::json::ReadOptionalBool(audio, keys::SoundAmbience.data(), state.audio.soundAmbience);
    state.audio.soundAppLaunch = lila::shared::data::json::ReadOptionalBool(audio, keys::SoundAppLaunch.data(), state.audio.soundAppLaunch);
    state.audio.soundNavigate = lila::shared::data::json::ReadOptionalBool(audio, keys::SoundNavigate.data(), state.audio.soundNavigate);
    state.audio.soundSelect = lila::shared::data::json::ReadOptionalBool(audio, keys::SoundSelect.data(), state.audio.soundSelect);
    state.audio.soundChatMessages = lila::shared::data::json::ReadOptionalBool(audio, keys::SoundChatMessages.data(), state.audio.soundChatMessages);
    state.audio.soundTableAmbience = lila::shared::data::json::ReadOptionalBool(audio, keys::SoundTableAmbience.data(), state.audio.soundTableAmbience);
    state.audio.soundAmbienceVolume = lila::shared::data::json::ReadOptionalInteger(audio, keys::SoundAmbienceVolume.data(), state.audio.soundAmbienceVolume);
    state.audio.soundAmbienceSplit = lila::shared::data::json::ReadOptionalBool(audio, keys::SoundAmbienceSplit.data(), state.audio.soundAmbienceSplit);
    state.audio.soundMenuAmbienceVolume = lila::shared::data::json::ReadOptionalInteger(audio, keys::SoundMenuAmbienceVolume.data(), state.audio.soundMenuAmbienceVolume);
    state.audio.soundTavernAmbienceVolume = lila::shared::data::json::ReadOptionalInteger(audio, keys::SoundTavernAmbienceVolume.data(), state.audio.soundTavernAmbienceVolume);
    state.audio.soundAppLaunchVolume = lila::shared::data::json::ReadOptionalInteger(audio, keys::SoundAppLaunchVolume.data(), state.audio.soundAppLaunchVolume);
    state.audio.soundNavigateVolume = lila::shared::data::json::ReadOptionalInteger(audio, keys::SoundNavigateVolume.data(), state.audio.soundNavigateVolume);
    state.audio.soundSelectVolume = lila::shared::data::json::ReadOptionalInteger(audio, keys::SoundSelectVolume.data(), state.audio.soundSelectVolume);
    state.audio.soundChatMessagesVolume = lila::shared::data::json::ReadOptionalInteger(audio, keys::SoundChatMessagesVolume.data(), state.audio.soundChatMessagesVolume);
    state.audio.soundTableAmbienceVolume = lila::shared::data::json::ReadOptionalInteger(audio, keys::SoundTableAmbienceVolume.data(), state.audio.soundTableAmbienceVolume);

    state.chat.chatEnabled = lila::shared::data::json::ReadOptionalBool(chat, keys::ChatEnabled.data(), state.chat.chatEnabled);
    state.chat.confirmChatExit = lila::shared::data::json::ReadOptionalBool(chat, keys::ConfirmChatExit.data(), state.chat.confirmChatExit);

    state.internal.admin.adminChatModerationLoadLimit = lila::shared::data::json::ReadOptionalInteger(
        admin,
        keys::AdminChatModerationLoadLimit.data(),
        state.internal.admin.adminChatModerationLoadLimit);

    const auto currentVersionIterator = runtime.find(std::string(keys::CurrentVersion));
    if (currentVersionIterator != runtime.end() && currentVersionIterator->is_string())
    {
        state.runtime.currentVersion = currentVersionIterator->get<std::string>();
    }

    state.Normalize();
    state.schemaVersion = domain::OptionsState::SchemaVersion;
    return state;
}

inline nlohmann::json Serialize(const domain::OptionsState& state)
{
    nlohmann::json document = {
        {std::string(keys::SchemaVersion), domain::OptionsState::SchemaVersion},
        {std::string(keys::General), {
            {std::string(keys::RestoreSessionOnStartup), state.general.restoreSessionOnStartup},
            {std::string(keys::ShowNavigationStatus), state.general.showNavigationStatus},
            {std::string(keys::ConfirmExit), state.general.confirmExit},
            {std::string(keys::EnableBetaGames), state.general.enableBetaGames},
        }},
        {std::string(keys::Audio), {
            {std::string(keys::MuteAll), state.audio.muteAll},
            {std::string(keys::SoundAmbience), state.audio.soundAmbience},
            {std::string(keys::SoundAppLaunch), state.audio.soundAppLaunch},
            {std::string(keys::SoundNavigate), state.audio.soundNavigate},
            {std::string(keys::SoundSelect), state.audio.soundSelect},
            {std::string(keys::SoundChatMessages), state.audio.soundChatMessages},
            {std::string(keys::SoundTableAmbience), state.audio.soundTableAmbience},
            {std::string(keys::SoundAmbienceVolume), state.audio.soundAmbienceVolume},
            {std::string(keys::SoundAmbienceSplit), state.audio.soundAmbienceSplit},
            {std::string(keys::SoundMenuAmbienceVolume), state.audio.soundMenuAmbienceVolume},
            {std::string(keys::SoundTavernAmbienceVolume), state.audio.soundTavernAmbienceVolume},
            {std::string(keys::SoundAppLaunchVolume), state.audio.soundAppLaunchVolume},
            {std::string(keys::SoundNavigateVolume), state.audio.soundNavigateVolume},
            {std::string(keys::SoundSelectVolume), state.audio.soundSelectVolume},
            {std::string(keys::SoundChatMessagesVolume), state.audio.soundChatMessagesVolume},
            {std::string(keys::SoundTableAmbienceVolume), state.audio.soundTableAmbienceVolume},
        }},
        {std::string(keys::Chat), {
            {std::string(keys::ChatEnabled), state.chat.chatEnabled},
            {std::string(keys::ConfirmChatExit), state.chat.confirmChatExit},
        }},
        {std::string(keys::Internal), {
            {std::string(keys::Admin), {
                {std::string(keys::AdminChatModerationLoadLimit), state.internal.admin.adminChatModerationLoadLimit},
            }},
        }},
        {std::string(keys::Runtime), nlohmann::json::object()},
    };

    if (state.runtime.currentVersion.has_value())
    {
        document[std::string(keys::CurrentVersion)] = *state.runtime.currentVersion;
        document[std::string(keys::Runtime)][std::string(keys::CurrentVersion)] = *state.runtime.currentVersion;
    }

    document[std::string(keys::Admin)] = document.at(std::string(keys::Internal)).at(std::string(keys::Admin));

    return document;
}
}
