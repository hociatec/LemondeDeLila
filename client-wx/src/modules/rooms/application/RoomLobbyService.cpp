#include "modules/rooms/application/RoomLobbyService.h"
#include "modules/rooms/application/IRoomLobbyGateway.h"

namespace lila::modules::rooms::application
{
RoomLobbyService::RoomLobbyService(IRoomLobbyGateway& gateway) noexcept : gateway_(gateway) {}
std::vector<domain::PublicRoom> RoomLobbyService::ListPublic(std::stop_token stopToken) const
{
    return gateway_.ListPublic(stopToken);
}
}
