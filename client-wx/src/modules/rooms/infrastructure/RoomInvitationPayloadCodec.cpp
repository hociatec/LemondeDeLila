#include "modules/rooms/infrastructure/RoomInvitationPayloadCodec.h"

#include <nlohmann/json.hpp>

namespace lila::modules::rooms::infrastructure
{
std::optional<domain::RoomInvitation> ReadRoomInvitationMessage(std::string_view rawJson)
{
    const auto envelope = nlohmann::json::parse(rawJson, nullptr, false);
    if (!envelope.is_object() || envelope.value("type", std::string{}) != "room.lobby.invite.received")
        return std::nullopt;
    const auto payload = envelope.value("payload", nlohmann::json::object());
    const auto room = payload.value("room", nlohmann::json::object());
    const auto from = payload.value("from", nlohmann::json::object());
    domain::RoomInvitation invitation;
    invitation.invitationId = payload.value("invitationId", std::string{});
    invitation.roomId = room.value("id", 0);
    invitation.roomName = room.value("name", std::string{});
    invitation.fromUserId = from.value("id", 0);
    invitation.fromUsername = from.value("username", std::string{});
    if (invitation.invitationId.empty() || invitation.roomId <= 0) return std::nullopt;
    return invitation;
}
}
