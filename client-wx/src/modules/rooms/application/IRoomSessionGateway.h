#pragma once

#include <stop_token>
#include <string_view>

#include "modules/rooms/domain/Room.h"

namespace lila::modules::rooms::application
{
class IRoomSessionGateway
{
public:
    virtual ~IRoomSessionGateway() = default;
    [[nodiscard]] virtual domain::RoomState Create(std::string_view gameType, std::stop_token stopToken) = 0;
    [[nodiscard]] virtual domain::RoomState Join(int roomId, bool spectator, std::stop_token stopToken) = 0;
    [[nodiscard]] virtual domain::RoomState Reconnect(std::stop_token stopToken) = 0;
    virtual void Execute(const domain::RoomCommandRequest& request, std::stop_token stopToken) = 0;
    [[nodiscard]] virtual domain::RoomEvent ReceiveEvent(std::stop_token stopToken) = 0;
    virtual void Interrupt() = 0;
    virtual void Leave() = 0;
    virtual void Close() = 0;
};
}
