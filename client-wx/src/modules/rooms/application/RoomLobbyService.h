#pragma once

#include <stop_token>
#include <string_view>
#include <vector>

#include "modules/rooms/domain/Room.h"

namespace lila::modules::rooms::application
{
class IRoomLobbyGateway;
class RoomLobbyService final
{
public:
    explicit RoomLobbyService(IRoomLobbyGateway& gateway) noexcept;
    [[nodiscard]] std::vector<domain::PublicRoom> ListPublic(std::stop_token stopToken) const;
    [[nodiscard]] std::vector<domain::RoomInviteCandidate> ListInviteCandidates(
        int roomId, std::stop_token stopToken) const;
    [[nodiscard]] std::vector<domain::TableAmbience> ListTableAmbiences(
        std::stop_token stopToken) const;
    void SendInvite(int roomId, int userId, std::stop_token stopToken) const;
    void RespondInvite(std::string_view invitationId, bool accept, std::stop_token stopToken) const;
private:
    IRoomLobbyGateway& gateway_;
};
}
