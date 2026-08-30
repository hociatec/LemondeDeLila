#pragma once

#include <stop_token>
#include <string_view>
#include <vector>

#include "modules/rooms/domain/Room.h"

namespace lila::modules::rooms::application
{
class IRoomLobbyGateway
{
public:
    virtual ~IRoomLobbyGateway() = default;
    [[nodiscard]] virtual std::vector<domain::PublicRoom> ListPublic(std::stop_token stopToken) const = 0;
    [[nodiscard]] virtual std::vector<domain::RoomInviteCandidate> ListInviteCandidates(
        int roomId, std::stop_token stopToken) const = 0;
    [[nodiscard]] virtual std::vector<domain::TableAmbience> ListTableAmbiences(
        std::stop_token stopToken) const = 0;
    virtual void SendInvite(int roomId, int userId, std::stop_token stopToken) const = 0;
    virtual void RespondInvite(
        std::string_view invitationId, bool accept, std::stop_token stopToken) const = 0;
};
}
