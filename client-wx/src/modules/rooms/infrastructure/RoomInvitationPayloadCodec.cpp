#include "modules/rooms/infrastructure/RoomInvitationPayloadCodec.h"
#include "modules/rooms/infrastructure/RoomProtocol.h"

#include <nlohmann/json.hpp>
#include <stdexcept>

namespace lila::modules::rooms::infrastructure
{
domain::RoomInvitationResponse ReadRoomInvitationResponse(
    std::string_view type, const nlohmann::json& payload, bool accept)
{
    if (!payload.is_object()) throw std::runtime_error("Reponse d'invitation invalide.");
    if (payload.value("expired", false))
        throw std::runtime_error("Cette invitation a expire. Demandez une nouvelle invitation.");
    if (!accept && type == "room.lobby.invite.responded") return {};
    if (accept && type == "room.lobby.invite.accepted")
    {
        const auto roomId = payload.value("roomId", 0);
        if (roomId > 0 && payload.contains("spectator") && payload["spectator"].is_boolean())
            return {roomId, payload["spectator"].get<bool>()};
    }
    throw std::runtime_error("L'invitation n'a pas ete acceptee par le serveur.");
}

std::optional<domain::RoomInvitation> ReadRoomInvitationMessage(std::string_view rawJson)
{
    const auto envelope = nlohmann::json::parse(rawJson, nullptr, false);
    if (!envelope.is_object() || envelope.value("type", std::string{}) !=
            protocol::LobbyInviteReceived)
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
