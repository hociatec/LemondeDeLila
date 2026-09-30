#include "modules/rooms/application/RoomSessionService.h"

#include <chrono>
#include <string>
#include <utility>

#include "modules/rooms/application/IRoomSessionGateway.h"
#include "shared/logging/application/Logger.h"
#include "shared/network/application/realtime/ReconnectPolicy.h"

namespace lila::modules::rooms::application
{
namespace
{
constexpr auto KeepAliveInterval = std::chrono::seconds(15);
}

void RoomSessionService::Start()
{
    std::scoped_lock lifecycleLock(lifecycleMutex_);
    if (receiveThread_.joinable() || keepAliveThread_.joinable()) return;
    const auto generation = sessionGeneration_.load();
    reconnecting_.store(false);
    receiveThread_ = std::jthread(
        [this, generation](std::stop_token stopToken) { ReceiveLoop(stopToken, generation); });
    keepAliveThread_ = std::jthread(
        [this, generation](std::stop_token stopToken) { KeepAliveLoop(stopToken, generation); });
}

void RoomSessionService::StopTasks(bool leaveRoom)
{
    ++sessionGeneration_;
    reconnecting_.store(false);
    if (receiveThread_.joinable()) receiveThread_.request_stop();
    if (keepAliveThread_.joinable()) keepAliveThread_.request_stop();

    if (leaveRoom) gateway_.Leave();
    else gateway_.Close();

    receiveThread_ = std::jthread{};
    keepAliveThread_ = std::jthread{};
}

void RoomSessionService::ReceiveLoop(std::stop_token stopToken, std::size_t generation)
{
    lila::shared::network::realtime::ReconnectPolicy reconnectPolicy;
    while (!stopToken.stop_requested() && sessionGeneration_.load() == generation)
    {
        try
        {
            auto event = gateway_.ReceiveEvent(stopToken);
            reconnectPolicy.Reset();
            if (event.type == domain::RoomEventType::Ignored) continue;
            const bool closed = event.type == domain::RoomEventType::Closed;
            NotifyEvent(std::move(event), generation);
            if (closed) return;
        }
        catch (const std::exception& exception)
        {
            if (stopToken.stop_requested() || sessionGeneration_.load() != generation) return;
            lila::shared::logging::LogWarning("Rooms", exception.what());
            reconnecting_.store(true);
            NotifyEvent(
                {domain::RoomEventType::ConnectionStatus, {}, {},
                 std::string("Reconnexion " "\xC3\xA0" " la table..."), false, {}},
                generation);

            while (!stopToken.stop_requested() && sessionGeneration_.load() == generation)
            {
                if (lila::shared::network::realtime::WaitForCancellation(
                        stopToken, reconnectPolicy.NextDelay())) return;
                try
                {
                    auto room = gateway_.Reconnect(stopToken);
                    reconnecting_.store(false);
                    reconnectPolicy.Reset();
                    NotifyEvent(
                        {domain::RoomEventType::StateUpdated,
                         std::move(room), {}, {}, false, {}},
                        generation);
                    NotifyEvent(
                        {domain::RoomEventType::ConnectionStatus, {}, {},
                         std::string("Connexion " "\xC3\xA0" " la table r" "\xC3\xA9" "tablie."),
                         false, {}},
                        generation);
                    break;
                }
                catch (const std::exception& reconnectError)
                {
                    lila::shared::logging::LogWarning("Rooms", reconnectError.what());
                }
            }
        }
    }
}

void RoomSessionService::KeepAliveLoop(std::stop_token stopToken, std::size_t generation)
{
    while (!lila::shared::network::realtime::WaitForCancellation(
        stopToken,
        std::chrono::duration_cast<std::chrono::milliseconds>(KeepAliveInterval)))
    {
        if (sessionGeneration_.load() != generation) return;
        if (reconnecting_.load()) continue;
        try
        {
            gateway_.Execute({domain::RoomCommand::Ping, false, {}}, stopToken);
        }
        catch (...)
        {
            if (!stopToken.stop_requested()) gateway_.Interrupt();
        }
    }
}

void RoomSessionService::NotifyEvent(domain::RoomEvent event, std::size_t generation)
{
    if (sessionGeneration_.load() != generation) return;
    EventHandler handler;
    {
        std::scoped_lock lock(eventHandlerMutex_);
        handler = eventHandler_;
    }
    if (handler) handler(std::move(event));
}
}
