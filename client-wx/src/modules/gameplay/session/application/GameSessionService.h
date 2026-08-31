#pragma once

#include <atomic>
#include <functional>
#include <mutex>
#include <stop_token>
#include <string_view>
#include <thread>

#include "modules/gameplay/session/domain/GameActionCandidates.h"
#include "modules/gameplay/session/domain/GameCommandEnvelope.h"
#include "modules/gameplay/session/domain/GameEvent.h"
#include "modules/gameplay/state/domain/GameState.h"

namespace lila::modules::gameplay::application
{
class IGameSessionGateway;

class GameSessionService final
{
public:
    using EventHandler = std::function<void(domain::GameEvent)>;

    explicit GameSessionService(IGameSessionGateway& gateway) noexcept;
    ~GameSessionService();

    [[nodiscard]] domain::GameState Join(
        int roomId,
        std::string_view gameType,
        std::stop_token stopToken);
    void Start();
    void SetEventHandler(EventHandler handler);
    void ClearEventHandler();
    void RequestState(std::stop_token stopToken);
    void RequestRules(std::stop_token stopToken);
    void SendKey(std::string_view key, std::stop_token stopToken);
    void ExecuteAction(const domain::GameCommandEnvelope& command, std::stop_token stopToken);
    void RequestActionCandidates(
        const domain::GameActionCandidatesRequest& request,
        std::stop_token stopToken);
    void Close();

private:
    void StopTasks();
    void ReceiveLoop(std::stop_token stopToken, std::size_t generation);
    void NotifyEvent(domain::GameEvent event, std::size_t generation);

    IGameSessionGateway& gateway_;
    std::jthread receiveThread_;
    std::mutex eventHandlerMutex_;
    EventHandler eventHandler_;
    std::atomic<std::size_t> sessionGeneration_ = 0;
};
}
