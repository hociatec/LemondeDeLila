#include "modules/gameplay/application/GameSessionService.h"

#include <exception>
#include <optional>
#include <utility>

#include "modules/gameplay/application/IGameSessionGateway.h"

namespace lila::modules::gameplay::application
{
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
    StopTasks();
    return gateway_.Join(roomId, gameType, stopToken);
}

void GameSessionService::Start()
{
    StopTasks();
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

void GameSessionService::ExecuteAction(const domain::GameAction& action, std::stop_token stopToken)
{
    gateway_.ExecuteAction(action, stopToken);
}

void GameSessionService::Close()
{
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
            if (!stopToken.stop_requested())
            {
                NotifyEvent(
                    domain::GameEvent{
                        domain::GameEventType::Error,
                        std::nullopt,
                        exception.what(),
                        true},
                    generation);
            }
            return;
        }
        catch (...)
        {
            if (!stopToken.stop_requested())
            {
                NotifyEvent(
                    domain::GameEvent{
                        domain::GameEventType::Error,
                        std::nullopt,
                        "Connexion au jeu interrompue.",
                        true},
                    generation);
            }
            return;
        }
    }
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
