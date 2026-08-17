#include "modules/options/infrastructure/FileOptionsRepository.h"
#include "shared/data/JsonReaders.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/persistence/JsonFileStorage.h"

#include <nlohmann/json.hpp>

#include <stdexcept>
#include <string>

namespace lila::modules::options::infrastructure
{
namespace
{
domain::OptionsState ParseOptions(const nlohmann::json& document)
{
    if (!document.is_object())
    {
        throw std::runtime_error(lila::shared::errors::InvalidOptionsFile);
    }

    domain::OptionsState state;
    state.restoreSessionOnStartup = lila::shared::data::json::ReadOptionalBool(document, "restoreSessionOnStartup", state.restoreSessionOnStartup);
    state.showNavigationStatus = lila::shared::data::json::ReadOptionalBool(document, "showNavigationStatus", state.showNavigationStatus);
    state.muteAll = lila::shared::data::json::ReadOptionalBool(document, "muteAll", state.muteAll);
    state.confirmExit = lila::shared::data::json::ReadOptionalBool(
        document,
        "confirmExit",
        lila::shared::data::json::ReadOptionalBool(document, "confirmLogout", state.confirmExit));
    state.repairBrokenAccents = lila::shared::data::json::ReadOptionalBool(document, "repairBrokenAccents", state.repairBrokenAccents);
    state.enableBetaGames = lila::shared::data::json::ReadOptionalBool(document, "enableBetaGames", state.enableBetaGames);
    state.soundAmbience = lila::shared::data::json::ReadOptionalBool(document, "soundAmbience", state.soundAmbience);
    state.soundAppLaunch = lila::shared::data::json::ReadOptionalBool(document, "soundAppLaunch", state.soundAppLaunch);
    state.soundNavigate = lila::shared::data::json::ReadOptionalBool(document, "soundNavigate", state.soundNavigate);
    state.soundSelect = lila::shared::data::json::ReadOptionalBool(document, "soundSelect", state.soundSelect);
    state.soundChatMessages = lila::shared::data::json::ReadOptionalBool(document, "soundChatMessages", state.soundChatMessages);
    state.soundTableAmbience = lila::shared::data::json::ReadOptionalBool(document, "soundTableAmbience", state.soundTableAmbience);
    state.soundAmbienceVolume = lila::shared::data::json::ReadOptionalInteger(document, "soundAmbienceVolume", state.soundAmbienceVolume);
    state.soundAmbienceSplit = lila::shared::data::json::ReadOptionalBool(document, "soundAmbienceSplit", state.soundAmbienceSplit);
    state.soundMenuAmbienceVolume = lila::shared::data::json::ReadOptionalInteger(document, "soundMenuAmbienceVolume", state.soundMenuAmbienceVolume);
    state.soundTavernAmbienceVolume = lila::shared::data::json::ReadOptionalInteger(document, "soundTavernAmbienceVolume", state.soundTavernAmbienceVolume);
    state.soundAppLaunchVolume = lila::shared::data::json::ReadOptionalInteger(document, "soundAppLaunchVolume", state.soundAppLaunchVolume);
    state.soundNavigateVolume = lila::shared::data::json::ReadOptionalInteger(document, "soundNavigateVolume", state.soundNavigateVolume);
    state.soundSelectVolume = lila::shared::data::json::ReadOptionalInteger(document, "soundSelectVolume", state.soundSelectVolume);
    state.soundChatMessagesVolume = lila::shared::data::json::ReadOptionalInteger(document, "soundChatMessagesVolume", state.soundChatMessagesVolume);
    state.soundTableAmbienceVolume = lila::shared::data::json::ReadOptionalInteger(document, "soundTableAmbienceVolume", state.soundTableAmbienceVolume);
    state.chatEnabled = lila::shared::data::json::ReadOptionalBool(document, "chatEnabled", state.chatEnabled);
    state.confirmChatExit = lila::shared::data::json::ReadOptionalBool(document, "confirmChatExit", state.confirmChatExit);
    state.adminChatModerationLoadLimit = lila::shared::data::json::ReadOptionalInteger(
        document,
        "adminChatModerationLoadLimit",
        state.adminChatModerationLoadLimit);
    state.currentVersion = lila::shared::data::json::ReadOptionalString(document, "currentVersion", state.currentVersion);
    state.Normalize();
    return state;
}
}

domain::OptionsState FileOptionsRepository::Load() const
{
    const wxString path = lila::shared::persistence::JsonFileStorage::ResolvePath("options.json");
    nlohmann::json document;
    try
    {
        if (!lila::shared::persistence::JsonFileStorage::ReadIfExists(path, document))
        {
            return {};
        }
    }
    catch (const std::exception& error)
    {
        throw std::runtime_error(std::string(lila::shared::errors::InvalidOptionsFile) + " " + error.what());
    }

    return ParseOptions(document);
}

void FileOptionsRepository::Save(const domain::OptionsState& state) const
{
    const wxString path = lila::shared::persistence::JsonFileStorage::ResolvePath("options.json");
    const nlohmann::json document = {
        {"restoreSessionOnStartup", state.restoreSessionOnStartup},
        {"showNavigationStatus", state.showNavigationStatus},
        {"muteAll", state.muteAll},
        {"confirmExit", state.confirmExit},
        {"repairBrokenAccents", state.repairBrokenAccents},
        {"enableBetaGames", state.enableBetaGames},
        {"soundAmbience", state.soundAmbience},
        {"soundAppLaunch", state.soundAppLaunch},
        {"soundNavigate", state.soundNavigate},
        {"soundSelect", state.soundSelect},
        {"soundChatMessages", state.soundChatMessages},
        {"soundTableAmbience", state.soundTableAmbience},
        {"soundAmbienceVolume", state.soundAmbienceVolume},
        {"soundAmbienceSplit", state.soundAmbienceSplit},
        {"soundMenuAmbienceVolume", state.soundMenuAmbienceVolume},
        {"soundTavernAmbienceVolume", state.soundTavernAmbienceVolume},
        {"soundAppLaunchVolume", state.soundAppLaunchVolume},
        {"soundNavigateVolume", state.soundNavigateVolume},
        {"soundSelectVolume", state.soundSelectVolume},
        {"soundChatMessagesVolume", state.soundChatMessagesVolume},
        {"soundTableAmbienceVolume", state.soundTableAmbienceVolume},
        {"chatEnabled", state.chatEnabled},
        {"confirmChatExit", state.confirmChatExit},
        {"adminChatModerationLoadLimit", state.adminChatModerationLoadLimit},
        {"currentVersion", state.currentVersion},
    };

    lila::shared::persistence::JsonFileStorage::Write(
        path,
        document,
        "Impossible de sauvegarder les options.");
}
}
