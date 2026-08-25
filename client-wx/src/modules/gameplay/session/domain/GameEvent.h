#pragma once

#include <optional>
#include <string>

#include "modules/gameplay/state/domain/GameState.h"

namespace lila::modules::gameplay::domain
{
enum class GameEventType
{
    StateUpdated,
    Acknowledged,
    TurnUpdated,
    Error,
    Ignored,
};

struct GameEvent final
{
    GameEventType type = GameEventType::Ignored;
    std::optional<GameState> state;
    std::string message;
    bool isError = false;
};
}
