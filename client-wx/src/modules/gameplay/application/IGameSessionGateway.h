#pragma once

#include <stop_token>
#include <string_view>

#include "modules/gameplay/domain/GameAction.h"
#include "modules/gameplay/domain/GameEvent.h"
#include "modules/gameplay/domain/GameState.h"

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
    virtual void ExecuteAction(const domain::GameAction& action, std::stop_token stopToken) = 0;
    [[nodiscard]] virtual domain::GameEvent ReceiveEvent(std::stop_token stopToken) = 0;
    virtual void Interrupt() = 0;
    virtual void Close() = 0;
};
}
