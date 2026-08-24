#include "modules/options/infrastructure/OptionsJsonSchemaMigrator.h"

#include "modules/options/infrastructure/OptionsJsonDocumentCodec.h"

#include "shared/data/json/JsonApiHelpers.h"
#include "shared/data/json/JsonReaders.h"

#include <string>

namespace lila::modules::options::infrastructure::json
{
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
            {std::string(keys::RepairBrokenAccents), readBool(keys::RepairBrokenAccents, true)},
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
            {std::string(keys::SoundCues), nlohmann::json::object()},
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
        auto& audio = migrated[std::string(keys::Audio)];
        if (!HasObjectField(audio, keys::SoundCues))
        {
            audio[std::string(keys::SoundCues)] = nlohmann::json::object();
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
