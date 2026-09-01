#include "modules/rooms/application/RoomSessionService.h"
#include "modules/rooms/application/IRoomSessionGateway.h"

#include <chrono>
#include <stdexcept>
#include <string>
#include <utility>

#include "shared/logging/application/Logger.h"

namespace lila::modules::rooms::application
{
namespace
{
using Clock = std::chrono::steady_clock;

long long MillisecondsSince(Clock::time_point start)
{
    return std::chrono::duration_cast<std::chrono::milliseconds>(Clock::now() - start).count();
}

void ThrowIfCancelled(std::stop_token stopToken)
{
    if (stopToken.stop_requested()) throw std::runtime_error("Ouverture de table interrompue.");
}
}

RoomSessionService::RoomSessionService(IRoomSessionGateway& gateway) noexcept : gateway_(gateway) {}
RoomSessionService::~RoomSessionService() { Close(); }
domain::RoomState RoomSessionService::Create(std::string_view gameType, std::stop_token stopToken)
{
    const auto startedAt = Clock::now();
    std::scoped_lock lifecycleLock(lifecycleMutex_);
    ThrowIfCancelled(stopToken);
    CloseSessionLocked();
    const auto shutdownMs = MillisecondsSince(startedAt);
    ThrowIfCancelled(stopToken);
    auto room = gateway_.Create(gameType, stopToken);
    lila::shared::logging::LogInfo(
        "RoomOpenTiming",
        "create shutdownMs=" + std::to_string(shutdownMs) +
            " transportMs=" + std::to_string(MillisecondsSince(startedAt) - shutdownMs) +
            " totalMs=" + std::to_string(MillisecondsSince(startedAt)));
    return room;
}
domain::RoomState RoomSessionService::Join(int roomId, bool spectator, std::stop_token stopToken)
{
    const auto startedAt = Clock::now();
    std::scoped_lock lifecycleLock(lifecycleMutex_);
    ThrowIfCancelled(stopToken);
    CloseSessionLocked();
    const auto shutdownMs = MillisecondsSince(startedAt);
    ThrowIfCancelled(stopToken);
    auto room = gateway_.Join(roomId, spectator, stopToken);
    lila::shared::logging::LogInfo(
        "RoomOpenTiming",
        "join shutdownMs=" + std::to_string(shutdownMs) +
            " transportMs=" + std::to_string(MillisecondsSince(startedAt) - shutdownMs) +
            " totalMs=" + std::to_string(MillisecondsSince(startedAt)));
    return room;
}
domain::RoomState RoomSessionService::Restore(int roomId, std::stop_token stopToken)
{
    const auto startedAt = Clock::now();
    std::scoped_lock lifecycleLock(lifecycleMutex_);
    ThrowIfCancelled(stopToken);
    CloseSessionLocked();
    const auto shutdownMs = MillisecondsSince(startedAt);
    ThrowIfCancelled(stopToken);
    auto room = gateway_.Join(roomId, false, stopToken);
    lila::shared::logging::LogInfo(
        "RoomOpenTiming",
        "restore shutdownMs=" + std::to_string(shutdownMs) +
            " transportMs=" + std::to_string(MillisecondsSince(startedAt) - shutdownMs) +
            " totalMs=" + std::to_string(MillisecondsSince(startedAt)));
    return room;
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
    std::scoped_lock lifecycleLock(lifecycleMutex_);
    StopTasks(true);
}
void RoomSessionService::Close()
{
    std::scoped_lock lifecycleLock(lifecycleMutex_);
    CloseSessionLocked();
}
void RoomSessionService::CloseSessionLocked()
{
    StopTasks(false);
}
}
