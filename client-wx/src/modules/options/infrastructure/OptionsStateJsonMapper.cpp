#include "modules/options/infrastructure/OptionsStateJsonMapper.h"

#include "modules/options/infrastructure/OptionsJsonDocumentCodec.h"

#include "shared/data/json/JsonApiHelpers.h"
#include "shared/data/json/JsonReaders.h"
#include "shared/errors/catalog/CoreErrorMessages.h"

#include <string>

namespace lila::modules::options::infrastructure::json
{
domain::OptionsState ParseStateFromDocument(const nlohmann::json& migrated)
{
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
    state.general.repairBrokenAccents = lila::shared::data::json::ReadOptionalBool(general, keys::RepairBrokenAccents.data(), state.general.repairBrokenAccents);
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
    const auto cuesIterator = audio.find(std::string(keys::SoundCues));
    if (cuesIterator != audio.end() && cuesIterator->is_object())
    {
        for (auto iterator = cuesIterator->begin(); iterator != cuesIterator->end(); ++iterator)
        {
            if (!iterator.value().is_object())
            {
                continue;
            }
            domain::SoundCueOptions cue;
            cue.enabled = lila::shared::data::json::ReadOptionalBool(
                iterator.value(), keys::Enabled.data(), cue.enabled);
            cue.volume = lila::shared::data::json::ReadOptionalInteger(
                iterator.value(), keys::Volume.data(), cue.volume);
            state.audio.cues[iterator.key()] = cue;
        }
    }

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

nlohmann::json BuildStateDocument(const domain::OptionsState& state)
{
    nlohmann::json soundCues = nlohmann::json::object();
    for (const auto& [key, cue] : state.audio.cues)
    {
        soundCues[key] = {
            {std::string(keys::Enabled), cue.enabled},
            {std::string(keys::Volume), cue.volume},
        };
    }

    nlohmann::json document = {
        {std::string(keys::SchemaVersion), domain::OptionsState::SchemaVersion},
        {std::string(keys::General), {
            {std::string(keys::RestoreSessionOnStartup), state.general.restoreSessionOnStartup},
            {std::string(keys::ShowNavigationStatus), state.general.showNavigationStatus},
            {std::string(keys::ConfirmExit), state.general.confirmExit},
            {std::string(keys::RepairBrokenAccents), state.general.repairBrokenAccents},
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
            {std::string(keys::SoundCues), std::move(soundCues)},
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
