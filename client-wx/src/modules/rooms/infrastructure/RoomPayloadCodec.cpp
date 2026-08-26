#include "modules/rooms/infrastructure/RoomPayloadCodec.h"

#include <string>
#include <nlohmann/json.hpp>
#include "shared/data/json/JsonCoercion.h"
#include "shared/data/json/JsonReaders.h"
#include "shared/errors/domain/AppError.h"
#include "modules/rooms/domain/RoomErrorMessages.h"

namespace lila::modules::rooms::infrastructure::codec
{
namespace
{
[[noreturn]] void Invalid(const std::string& details)
{
    throw lila::shared::errors::AppException(lila::shared::errors::ToAppError(
        lila::shared::errors::RoomPayloadInvalid,
        details));
}

std::vector<domain::RoomMember> ReadMembers(
    const nlohmann::json& room,
    const char* field,
    const char* nameField)
{
    const auto values = room.find(field);
    if (values == room.end() || !values->is_array()) Invalid(std::string(field) + " must be an array.");
    std::vector<domain::RoomMember> result;
    result.reserve(values->size());
    for (const auto& value : *values)
    {
        if (!value.is_object()) Invalid(std::string(field) + " entry must be an object.");
        domain::RoomMember member{
            lila::shared::data::json::ReadRequiredInteger(value, "id"),
            lila::shared::data::json::ReadRequiredString(value, nameField)};
        if (member.id <= 0 || member.name.empty()) Invalid(std::string(field) + " entry is invalid.");
        result.push_back(std::move(member));
    }
    return result;
}
}

std::vector<domain::PublicRoom> ReadPublicRooms(const nlohmann::json& payload)
{
    if (!payload.is_object()) Invalid("Public rooms payload must be an object.");
    const auto items = payload.find("items");
    if (items == payload.end() || !items->is_array()) Invalid("Public room items must be an array.");
    std::vector<domain::PublicRoom> result;
    result.reserve(items->size());
    for (const auto& value : *items)
    {
        if (!value.is_object()) Invalid("Public room entry must be an object.");
        domain::PublicRoom room;
        room.id = lila::shared::data::json::ReadRequiredInteger(value, "id");
        room.name = lila::shared::data::json::ReadRequiredString(value, "name");
        room.gameType = lila::shared::data::json::ReadRequiredString(value, "gameType");
        room.status = lila::shared::data::json::ReadRequiredString(value, "status");
        room.started = value.value("started", false);
        room.spectatorOnly = value.value("spectatorOnly", false);
        room.maxPlayers = lila::shared::data::json::ReadRequiredInteger(value, "maxPlayers");
        room.playersCount = lila::shared::data::json::ReadRequiredInteger(value, "playersCount");
        room.botsCount = lila::shared::data::json::ReadRequiredInteger(value, "botsCount");
        const auto owner = value.find("owner");
        if (owner != value.end() && owner->is_object()) room.ownerUsername = owner->value("username", std::string{});
        if (room.id <= 0 || room.name.empty() || room.gameType.empty() || room.maxPlayers <= 0 ||
            room.playersCount < 0 || room.botsCount < 0) Invalid("Public room values are invalid.");
        result.push_back(std::move(room));
    }
    return result;
}

domain::RoomState ReadRoomState(const nlohmann::json& payload)
{
    if (!payload.is_object()) Invalid("Room payload must be an object.");
    const auto roomValue = payload.find("room");
    if (roomValue == payload.end() || !roomValue->is_object()) Invalid("Room state is missing.");
    const auto& room = *roomValue;
    domain::RoomState result;
    result.id = lila::shared::data::json::ReadRequiredInteger(room, "id");
    result.runId = lila::shared::data::json::ReadOptionalIntegerCoerced(
        room, "runId").value_or(0);
    result.name = lila::shared::data::json::ReadRequiredString(room, "name");
    result.gameType = lila::shared::data::json::ReadRequiredString(room, "gameType");
    result.status = lila::shared::data::json::ReadRequiredString(room, "status");
    const auto startedAt = room.find("startedAt");
    result.started = result.status == "started" ||
        (startedAt != room.end() && !startedAt->is_null() &&
         (!startedAt->is_string() || !startedAt->get<std::string>().empty()));
    result.isPrivate = room.value("isPrivate", false);
    result.maxPlayers = lila::shared::data::json::ReadRequiredInteger(room, "maxPlayers");
    const auto manifest = payload.find("manifest");
    result.gameName = manifest != payload.end() && manifest->is_object()
        ? manifest->value("name", result.gameType) : result.gameType;
    result.chatEnabled = manifest == payload.end() || !manifest->is_object() ||
        manifest->value("chatEnabled", true);
    result.minPlayers = manifest != payload.end() && manifest->is_object()
        ? manifest->value("minPlayers", 2) : 2;
    const auto owner = room.find("owner");
    if (owner != room.end() && owner->is_object())
    {
        result.ownerId = owner->value("id", 0);
        result.ownerName = owner->value("username", std::string{});
    }
    result.players = ReadMembers(room, "players", "username");
    result.spectators = ReadMembers(room, "spectators", "username");
    result.bots = ReadMembers(room, "bots", "name");
    const auto actions = room.find("allowedActions");
    if (actions != room.end() && actions->is_array())
    {
        for (const auto& action : *actions) if (action.is_string()) result.allowedActions.push_back(action.get<std::string>());
    }
    if (result.id <= 0 || result.name.empty() || result.gameType.empty() ||
        result.minPlayers <= 0 || result.maxPlayers < result.minPlayers)
        Invalid("Room identity is invalid.");
    return result;
}
}
