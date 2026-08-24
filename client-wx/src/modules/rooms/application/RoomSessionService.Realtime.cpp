#include "modules/rooms/application/RoomSessionService.h"

#include <algorithm>
#include <chrono>
#include <string>
#include <thread>
#include <utility>

#include "modules/rooms/application/IRoomSessionGateway.h"
#include "shared/logging/Logger.h"

namespace lila::modules::rooms::application
{
namespace
{
constexpr auto KeepAliveInterval = std::chrono::seconds(15);
constexpr auto ReconnectInitialDelay = std::chrono::milliseconds(1'000);
constexpr auto ReconnectMaximumDelay = std::chrono::milliseconds(30'000);

bool WaitForDelay(std::stop_token stopToken, std::chrono::milliseconds delay)
{
    constexpr auto PollStep = std::chrono::milliseconds(100);
    while (delay.count() > 0 && !stopToken.stop_requested())
    {
        const auto step = std::min(PollStep, delay);
        std::this_thread::sleep_for(step);
        delay -= step;
    }
    return stopToken.stop_requested();
}

std::chrono::milliseconds ReconnectDelay(int attempt)
{
    auto delay = ReconnectInitialDelay;
    for (int index = 0; index < attempt; ++index)
        delay = std::min(ReconnectMaximumDelay, delay * 2);
    return delay;
}
}

void RoomSessionService::Start()
{
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
    else gateway_.Interrupt();

    receiveThread_ = std::jthread{};
    keepAliveThread_ = std::jthread{};
}

void RoomSessionService::ReceiveLoop(std::stop_token stopToken, std::size_t generation)
{
    int reconnectAttempt = 0;
    while (!stopToken.stop_requested() && sessionGeneration_.load() == generation)
    {
        try
        {
            auto event = gateway_.ReceiveEvent(stopToken);
            reconnectAttempt = 0;
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
                 std::string("Reconnexion " "\xC3\xA0" " la table...")},
                generation);

            while (!stopToken.stop_requested() && sessionGeneration_.load() == generation)
            {
                if (WaitForDelay(stopToken, ReconnectDelay(reconnectAttempt))) return;
                try
                {
                    auto room = gateway_.Reconnect(stopToken);
                    reconnecting_.store(false);
                    reconnectAttempt = 0;
                    NotifyEvent({domain::RoomEventType::StateUpdated, std::move(room)}, generation);
                    NotifyEvent(
                        {domain::RoomEventType::ConnectionStatus, {}, {},
                         std::string("Connexion " "\xC3\xA0" " la table r" "\xC3\xA9" "tablie.")},
                        generation);
                    break;
                }
                catch (const std::exception& reconnectError)
                {
                    ++reconnectAttempt;
                    lila::shared::logging::LogWarning("Rooms", reconnectError.what());
                }
            }
        }
    }
}

void RoomSessionService::KeepAliveLoop(std::stop_token stopToken, std::size_t generation)
{
    while (!WaitForDelay(
        stopToken,
        std::chrono::duration_cast<std::chrono::milliseconds>(KeepAliveInterval)))
    {
        if (sessionGeneration_.load() != generation) return;
        if (reconnecting_.load()) continue;
        try
        {
            gateway_.Execute({domain::RoomCommand::Ping}, stopToken);
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
