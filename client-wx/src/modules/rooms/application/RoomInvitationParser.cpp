#include "modules/rooms/application/RoomInvitationParser.h"

#include <nlohmann/json.hpp>

namespace lila::modules::rooms::application
{
std::optional<domain::RoomInvitation> ParseRoomInvitation(std::string_view rawJson)
{
    const auto envelope = nlohmann::json::parse(rawJson, nullptr, false);
    if (!envelope.is_object() || envelope.value("type", std::string{}) != "room.lobby.invite.received") return std::nullopt;
    const auto payload = envelope.value("payload", nlohmann::json::object()); const auto room = payload.value("room", nlohmann::json::object()); const auto from = payload.value("from", nlohmann::json::object());
    domain::RoomInvitation invitation{payload.value("invitationId", std::string{}), room.value("id", 0), room.value("name", std::string{}), from.value("id", 0), from.value("username", std::string{})};
    return invitation.invitationId.empty() || invitation.roomId <= 0 ? std::nullopt : std::optional<domain::RoomInvitation>(std::move(invitation));
}
}
