#include "modules/rooms/infrastructure/RoomLobbyApi.h"
#include <nlohmann/json.hpp>
#include "modules/rooms/infrastructure/RoomPayloadCodec.h"
#include "modules/session/application/SessionStore.h"
#include "modules/rooms/domain/RoomErrorMessages.h"
#include "shared/network/application/realtime/AuthenticatedRealtimeApiHelpers.h"
#include "shared/config/domain/AppConfig.h"
#include "shared/network/domain/UrlUtils.h"
#include "shared/network/infrastructure/http/WsTicketTransport.h"
#include "modules/rooms/infrastructure/TableAmbiencePayloadCodec.h"

namespace lila::modules::rooms::infrastructure
{
namespace
{
constexpr auto ListEvent = "room.lobby.list";
constexpr auto ListedEvent = "room.lobby.listed";
constexpr auto InvitePresenceListEvent = "room.lobby.invite.presence.list";
constexpr auto InvitePresenceListedEvent = "room.lobby.invite.presence.listed";
constexpr auto InviteSendEvent = "room.lobby.invite.send";
constexpr auto InviteSentEvent = "room.lobby.invite.sent";
constexpr auto InviteRespondEvent = "room.lobby.invite.respond";
constexpr auto InviteRespondedEvent = "room.lobby.invite.responded";
}
RoomLobbyApi::RoomLobbyApi(
    lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client,
    lila::modules::session::application::SessionStore& sessionStore) noexcept
    : client_(client), sessionStore_(sessionStore) {}
std::vector<domain::PublicRoom> RoomLobbyApi::ListPublic(std::stop_token stopToken) const
{
    const auto response = lila::shared::network::realtime::helpers::SendAuthenticatedRequest(
        client_, sessionStore_, lila::shared::errors::NoActiveRoomSession,
        ListEvent, nlohmann::json::object(), lila::shared::errors::RoomLobbyLoadFailed,
        stopToken, ListedEvent);
    return codec::ReadPublicRooms(response.payload);
}

std::vector<domain::RoomInviteCandidate> RoomLobbyApi::ListInviteCandidates(
    int roomId, std::stop_token stopToken) const
{
    const auto response = lila::shared::network::realtime::helpers::SendAuthenticatedRequest(
        client_, sessionStore_, lila::shared::errors::NoActiveRoomSession,
        InvitePresenceListEvent, {{"roomId", roomId}},
        lila::shared::errors::RoomLobbyLoadFailed, stopToken,
        InvitePresenceListedEvent);
    std::vector<domain::RoomInviteCandidate> result;
    const auto players = response.payload.find("players");
    if (players == response.payload.end() || !players->is_array()) return result;
    for (const auto& raw : *players)
    {
        if (!raw.is_object()) continue;
        domain::RoomInviteCandidate candidate;
        candidate.id = raw.value("id", 0);
        candidate.username = raw.value("username", std::string{});
        candidate.availability = raw.value("availability", std::string{});
        candidate.pendingInvite = raw.value("pendingInvite", false);
        if (candidate.id > 0 && !candidate.username.empty()) result.push_back(std::move(candidate));
    }
    return result;
}

std::vector<domain::TableAmbience> RoomLobbyApi::ListTableAmbiences(
    std::stop_token stopToken) const
{
    if (stopToken.stop_requested()) return {};
    const auto endpoint = lila::shared::network::WebSocketOriginToHttp(
        lila::shared::config::AppConfig::ResolveBackendApiWs()) +
        "/api/sounds/table-ambiences";
    const auto raw = lila::shared::network::http::RequestWsTicketResponse(
        endpoint, sessionStore_.AccessToken(stopToken));
    return ReadTableAmbiencesResponse(raw);
}

void RoomLobbyApi::SendInvite(int roomId, int userId, std::stop_token stopToken) const
{
    static_cast<void>(lila::shared::network::realtime::helpers::SendAuthenticatedRequest(
        client_, sessionStore_, lila::shared::errors::NoActiveRoomSession,
        InviteSendEvent, {{"roomId", roomId}, {"userId", userId}},
        lila::shared::errors::RoomLobbyLoadFailed, stopToken,
        InviteSentEvent));
}

void RoomLobbyApi::RespondInvite(
    std::string_view invitationId, bool accept, std::stop_token stopToken) const
{
    static_cast<void>(lila::shared::network::realtime::helpers::SendAuthenticatedRequest(
        client_, sessionStore_, lila::shared::errors::NoActiveRoomSession,
        InviteRespondEvent,
        {{"invitationId", std::string(invitationId)}, {"accept", accept}},
        lila::shared::errors::RoomLobbyLoadFailed, stopToken,
        InviteRespondedEvent));
}
}
