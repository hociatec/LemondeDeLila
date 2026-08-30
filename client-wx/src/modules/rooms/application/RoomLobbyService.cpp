#include "modules/rooms/application/RoomLobbyService.h"
#include "modules/rooms/application/IRoomLobbyGateway.h"

namespace lila::modules::rooms::application
{
RoomLobbyService::RoomLobbyService(IRoomLobbyGateway& gateway) noexcept : gateway_(gateway) {}
std::vector<domain::PublicRoom> RoomLobbyService::ListPublic(std::stop_token stopToken) const
{
    return gateway_.ListPublic(stopToken);
}

std::vector<domain::RoomInviteCandidate> RoomLobbyService::ListInviteCandidates(
    int roomId, std::stop_token stopToken) const
{
    return gateway_.ListInviteCandidates(roomId, stopToken);
}

std::vector<domain::TableAmbience> RoomLobbyService::ListTableAmbiences(
    std::stop_token stopToken) const
{
    return gateway_.ListTableAmbiences(stopToken);
}

void RoomLobbyService::SendInvite(int roomId, int userId, std::stop_token stopToken) const
{
    gateway_.SendInvite(roomId, userId, stopToken);
}

void RoomLobbyService::RespondInvite(
    std::string_view invitationId, bool accept, std::stop_token stopToken) const
{
    gateway_.RespondInvite(invitationId, accept, stopToken);
}
}
