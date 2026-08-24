#pragma once

#include <stop_token>
#include <vector>

#include "modules/rooms/domain/Room.h"

namespace lila::modules::rooms::application
{
class IRoomLobbyGateway
{
public:
    virtual ~IRoomLobbyGateway() = default;
    [[nodiscard]] virtual std::vector<domain::PublicRoom> ListPublic(std::stop_token stopToken) const = 0;
};
}
