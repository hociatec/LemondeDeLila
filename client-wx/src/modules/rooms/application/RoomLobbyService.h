#pragma once

#include <stop_token>
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
private:
    IRoomLobbyGateway& gateway_;
};
}
