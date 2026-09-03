#include "modules/gameplay/session/application/GameSessionService.h"

#include <algorithm>
#include <chrono>
#include <exception>
#include <optional>
#include <stdexcept>
#include <thread>
#include <utility>

#include "modules/gameplay/session/application/IGameSessionGateway.h"
#include "shared/logging/application/Logger.h"

namespace lila::modules::gameplay::application
{
namespace
{
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

GameSessionService::GameSessionService(IGameSessionGateway& gateway) noexcept
    : gateway_(gateway)
{
}

GameSessionService::~GameSessionService()
{
    Close();
}

domain::GameState GameSessionService::Join(
    int roomId,
    std::string_view gameType,
    std::stop_token stopToken)
{
    std::scoped_lock lifecycleLock(lifecycleMutex_);
    StopTasks();
    if (stopToken.stop_requested())
        throw std::runtime_error("Connexion au jeu interrompue.");
    return gateway_.Join(roomId, gameType, stopToken);
}

void GameSessionService::Start()
{
    std::scoped_lock lifecycleLock(lifecycleMutex_);
    if (receiveThread_.joinable()) return;
    const auto generation = ++sessionGeneration_;
    receiveThread_ = std::jthread(
        [this, generation](std::stop_token stopToken)
        {
            ReceiveLoop(stopToken, generation);
        });
}

void GameSessionService::SetEventHandler(EventHandler handler)
{
    std::scoped_lock lock(eventHandlerMutex_);
    eventHandler_ = std::move(handler);
}

void GameSessionService::ClearEventHandler()
{
    std::scoped_lock lock(eventHandlerMutex_);
    eventHandler_ = {};
}

void GameSessionService::RequestState(std::stop_token stopToken)
{
    gateway_.RequestState(stopToken);
}

void GameSessionService::RequestRules(std::stop_token stopToken)
{
    gateway_.RequestRules(stopToken);
}

void GameSessionService::SendKey(std::string_view key, std::stop_token stopToken)
{
    gateway_.SendKey(key, stopToken);
}

void GameSessionService::ExecuteAction(
    const domain::GameCommandEnvelope& command,
    std::stop_token stopToken)
{
    gateway_.ExecuteAction(command, stopToken);
}

void GameSessionService::RequestActionCandidates(
    const domain::GameActionCandidatesRequest& request,
    std::stop_token stopToken)
{
    gateway_.RequestActionCandidates(request, stopToken);
}

void GameSessionService::Close()
{
    std::scoped_lock lifecycleLock(lifecycleMutex_);
    StopTasks();
    gateway_.Close();
}

void GameSessionService::StopTasks()
{
    ++sessionGeneration_;
    if (receiveThread_.joinable())
    {
        receiveThread_.request_stop();
        gateway_.Interrupt();
        receiveThread_.join();
    }
}

void GameSessionService::ReceiveLoop(std::stop_token stopToken, std::size_t generation)
{
    while (!stopToken.stop_requested() && generation == sessionGeneration_.load())
    {
        try
        {
            auto event = gateway_.ReceiveEvent(stopToken);
            NotifyEvent(std::move(event), generation);
        }
        catch (const std::exception& exception)
        {
            if (stopToken.stop_requested() || generation != sessionGeneration_.load()) return;
            lila::shared::logging::LogWarning("Game", exception.what());
            if (!ReconnectLoop(stopToken, generation)) return;
        }
        catch (...)
        {
            if (stopToken.stop_requested() || generation != sessionGeneration_.load()) return;
            lila::shared::logging::LogWarning("Game", "Connexion au jeu interrompue.");
            if (!ReconnectLoop(stopToken, generation)) return;
        }
    }
}

bool GameSessionService::ReconnectLoop(
    std::stop_token stopToken,
    std::size_t generation)
{
    NotifyEvent(
        {domain::GameEventType::ConnectionStatus, std::nullopt,
         std::string("Reconnexion au jeu..."), false, std::nullopt, {}, std::nullopt, {}},
        generation);

    int reconnectAttempt = 0;
    while (!stopToken.stop_requested() && generation == sessionGeneration_.load())
    {
        if (WaitForDelay(stopToken, ReconnectDelay(reconnectAttempt))) return false;
        try
        {
            auto state = gateway_.Reconnect(stopToken);
            if (stopToken.stop_requested() || generation != sessionGeneration_.load()) return false;

            NotifyEvent(
                {domain::GameEventType::ConnectionStatus, std::nullopt,
                 std::string("Connexion au jeu r\xC3\xA9tablie."), false,
                 std::nullopt, {}, std::nullopt, {}},
                generation);
            NotifyEvent(
                {domain::GameEventType::StateUpdated, std::move(state), {}, false,
                 std::nullopt, {}, std::nullopt, {}},
                generation);
            return true;
        }
        catch (const std::exception& exception)
        {
            ++reconnectAttempt;
            if (!stopToken.stop_requested())
                lila::shared::logging::LogWarning("Game", exception.what());
        }
        catch (...)
        {
            ++reconnectAttempt;
            if (!stopToken.stop_requested())
                lila::shared::logging::LogWarning("Game", "Reconnexion au jeu impossible.");
        }
    }
    return false;
}

void GameSessionService::NotifyEvent(domain::GameEvent event, std::size_t generation)
{
    if (generation != sessionGeneration_.load()) return;
    EventHandler handler;
    {
        std::scoped_lock lock(eventHandlerMutex_);
        handler = eventHandler_;
    }
    if (handler) handler(std::move(event));
}
}
