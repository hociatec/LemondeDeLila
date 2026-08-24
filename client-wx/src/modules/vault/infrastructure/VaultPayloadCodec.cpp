#include "modules/vault/infrastructure/VaultPayloadCodec.h"

#include <string>
#include <utility>

#include <nlohmann/json.hpp>

#include "shared/data/json/JsonReaders.h"
#include "shared/errors/domain/AppError.h"
#include "shared/errors/catalog/ErrorMessages.h"

namespace lila::modules::vault::infrastructure::codec
{
namespace
{
[[noreturn]] void Invalid(const std::string& details)
{
    throw lila::shared::errors::AppException(lila::shared::errors::ToAppError(
        lila::shared::errors::ErrorCode::JsonCorrupted,
        lila::shared::errors::VaultPayloadInvalid,
        details));
}
}

nlohmann::json BuildSaveRequest(int roomId)
{
    if (roomId <= 0) Invalid("Vault save room id is invalid.");
    return {{"roomId", roomId}};
}

nlohmann::json BuildAbandonRequest(int roomId)
{
    if (roomId <= 0) Invalid("Vault abandon room id is invalid.");
    return {{"roomId", roomId}};
}

std::vector<domain::VaultSnapshot> ReadSnapshots(const nlohmann::json& payload)
{
    if (!payload.is_object()) Invalid("Vault payload must be an object.");
    const auto items = payload.find("items");
    if (items == payload.end() || !items->is_array()) Invalid("Vault items must be an array.");

    std::vector<domain::VaultSnapshot> result;
    result.reserve(items->size());
    for (const auto& value : *items)
    {
        if (!value.is_object()) Invalid("Vault item must be an object.");
        domain::VaultSnapshot snapshot{
            lila::shared::data::json::ReadRequiredString(value, "id"),
            lila::shared::data::json::ReadRequiredString(value, "name"),
            lila::shared::data::json::ReadRequiredString(value, "roomName"),
            lila::shared::data::json::ReadRequiredString(value, "gameType"),
            lila::shared::data::json::ReadRequiredString(value, "playersLabel"),
            lila::shared::data::json::ReadRequiredString(value, "createdAt")};
        if (snapshot.id.empty() || snapshot.name.empty() || snapshot.roomName.empty() ||
            snapshot.gameType.empty())
        {
            Invalid("Vault item identity is invalid.");
        }
        result.push_back(std::move(snapshot));
    }
    return result;
}

std::string ReadSavedId(const nlohmann::json& payload)
{
    if (!payload.is_object()) Invalid("Vault save payload must be an object.");
    auto id = lila::shared::data::json::ReadRequiredString(payload, "id");
    if (id.empty()) Invalid("Saved snapshot id is empty.");
    return id;
}

int ReadRestoredRoomId(const nlohmann::json& payload)
{
    if (!payload.is_object()) Invalid("Vault restore payload must be an object.");
    const auto roomId = lila::shared::data::json::ReadRequiredInteger(payload, "roomId");
    if (roomId <= 0) Invalid("Restored room id is invalid.");
    return roomId;
}

void ValidateDelete(const nlohmann::json& payload)
{
    if (!payload.is_object() || !payload.value("ok", false))
    {
        Invalid("Vault delete was rejected.");
    }
}

void ValidateAbandon(const nlohmann::json& payload)
{
    if (!payload.is_object() || !payload.value("ok", false))
    {
        Invalid("Restored vault room abandon was rejected.");
    }
}
}
