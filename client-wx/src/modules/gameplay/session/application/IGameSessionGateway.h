#pragma once

#include <stop_token>
#include <string_view>

#include "modules/gameplay/session/domain/GameActionCandidates.h"
#include "modules/gameplay/session/domain/GameCommandEnvelope.h"
#include "modules/gameplay/session/domain/GameEvent.h"
#include "modules/gameplay/state/domain/GameState.h"

namespace lila::modules::gameplay::application
{
class IGameSessionGateway
{
public:
    virtual ~IGameSessionGateway() = default;
    [[nodiscard]] virtual domain::GameState Join(
        int roomId,
        std::string_view gameType,
        std::stop_token stopToken) = 0;
    virtual void RequestState(std::stop_token stopToken) = 0;
    virtual void RequestRules(std::stop_token stopToken) = 0;
    virtual void SendKey(std::string_view key, std::stop_token stopToken) = 0;
    virtual void ExecuteAction(
        const domain::GameCommandEnvelope& command,
        std::stop_token stopToken) = 0;
    virtual void RequestActionCandidates(
        const domain::GameActionCandidatesRequest& request,
        std::stop_token stopToken) = 0;
    [[nodiscard]] virtual domain::GameEvent ReceiveEvent(std::stop_token stopToken) = 0;
    virtual void Interrupt() = 0;
    virtual void Close() = 0;
};
}
