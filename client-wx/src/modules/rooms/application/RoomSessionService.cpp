#include "modules/rooms/application/RoomSessionService.h"
#include "modules/rooms/application/IRoomSessionGateway.h"

#include <utility>

namespace lila::modules::rooms::application
{
RoomSessionService::RoomSessionService(IRoomSessionGateway& gateway) noexcept : gateway_(gateway) {}
RoomSessionService::~RoomSessionService() { Close(); }
domain::RoomState RoomSessionService::Create(std::string_view gameType, std::stop_token stopToken)
{
    Close();
    return gateway_.Create(gameType, stopToken);
}
domain::RoomState RoomSessionService::Join(int roomId, bool spectator, std::stop_token stopToken)
{
    Close();
    return gateway_.Join(roomId, spectator, stopToken);
}
domain::RoomState RoomSessionService::Restore(int roomId, std::stop_token stopToken)
{
    Close();
    return gateway_.Join(roomId, false, stopToken);
}
void RoomSessionService::Execute(const domain::RoomCommandRequest& request, std::stop_token stopToken)
{
    gateway_.Execute(request, stopToken);
}
void RoomSessionService::SetEventHandler(EventHandler handler)
{
    std::scoped_lock lock(eventHandlerMutex_);
    eventHandler_ = std::move(handler);
}
void RoomSessionService::ClearEventHandler()
{
    std::scoped_lock lock(eventHandlerMutex_);
    eventHandler_ = {};
}
void RoomSessionService::Leave()
{
    StopTasks(true);
}
void RoomSessionService::Close()
{
    StopTasks(false);
    gateway_.Close();
}
}
