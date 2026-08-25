#include "modules/rooms/presentation/navigation/RoomOpenRequest.h"

#include <utility>

namespace lila::modules::rooms::presentation
{
RoomOpenRequest RoomOpenRequest::Create(
    std::string gameType,
    std::string gameName,
    std::string gameSummary,
    std::string gameEngine,
    int minPlayers,
    int maxPlayers)
{
    RoomOpenRequest request;
    request.kind = Kind::Create;
    request.gameType = std::move(gameType);
    request.gameName = std::move(gameName);
    request.gameSummary = std::move(gameSummary);
    request.gameEngine = std::move(gameEngine);
    request.minPlayers = minPlayers;
    request.maxPlayers = maxPlayers;
    return request;
}

RoomOpenRequest RoomOpenRequest::Join(int roomId, bool spectator)
{
    RoomOpenRequest request;
    request.kind = Kind::Join;
    request.roomId = roomId;
    request.spectator = spectator;
    return request;
}

RoomOpenRequest RoomOpenRequest::Restore(int roomId)
{
    RoomOpenRequest request;
    request.kind = Kind::Restore;
    request.roomId = roomId;
    return request;
}
}
