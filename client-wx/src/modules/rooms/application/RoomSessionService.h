#pragma once

#include <atomic>
#include <functional>
#include <mutex>
#include <stop_token>
#include <string_view>
#include <thread>

#include "modules/rooms/domain/Room.h"

namespace lila::modules::rooms::application
{
class IRoomSessionGateway;
}
namespace lila::modules::rooms::application
{
class RoomSessionService final
{
public:
    using EventHandler = std::function<void(domain::RoomEvent)>;

    explicit RoomSessionService(IRoomSessionGateway& gateway) noexcept;
    ~RoomSessionService();
    [[nodiscard]] domain::RoomState Create(std::string_view gameType, std::stop_token stopToken);
    [[nodiscard]] domain::RoomState Join(int roomId, bool spectator, std::stop_token stopToken);
    [[nodiscard]] domain::RoomState Restore(int roomId, std::stop_token stopToken);
    void Start();
    void SetEventHandler(EventHandler handler);
    void ClearEventHandler();
    void Execute(const domain::RoomCommandRequest& request, std::stop_token stopToken);
    void Leave();
    void Close();
private:
    void CloseSessionLocked();
    void StopTasks(bool leaveRoom);
    void ReceiveLoop(std::stop_token stopToken, std::size_t generation);
    void KeepAliveLoop(std::stop_token stopToken, std::size_t generation);
    void NotifyEvent(domain::RoomEvent event, std::size_t generation);

    IRoomSessionGateway& gateway_;
    std::jthread receiveThread_;
    std::jthread keepAliveThread_;
    std::mutex lifecycleMutex_;
    std::mutex eventHandlerMutex_;
    EventHandler eventHandler_;
    std::atomic<std::size_t> sessionGeneration_ = 0;
    std::atomic<bool> reconnecting_ = false;
};
}
