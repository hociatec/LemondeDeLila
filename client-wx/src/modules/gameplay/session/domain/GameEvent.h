#pragma once

#include <optional>
#include <string>

#include "modules/gameplay/session/domain/GameActionCandidates.h"
#include "modules/gameplay/state/domain/GameState.h"

namespace lila::modules::gameplay::domain
{
enum class GameEventType
{
    StateUpdated,
    Acknowledged,
    TurnUpdated,
    ActionCandidates,
    Rules,
    Error,
    Ignored,
};

struct GameAcknowledgement final
{
    std::string command;
    bool ok = false;
    std::string key;
    std::string panelId;
    std::string roomOperation;
    std::string message;
};

struct GameEvent final
{
    GameEventType type = GameEventType::Ignored;
    std::optional<GameState> state;
    std::string message;
    bool isError = false;
    std::optional<GameAcknowledgement> acknowledgement;
    std::string rules;
    std::optional<GameActionCandidatesResult> candidates;
    std::string errorCode;
};
}
