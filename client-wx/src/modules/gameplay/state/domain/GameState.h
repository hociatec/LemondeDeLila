#pragma once

#include <string>
#include <optional>
#include <vector>

#include <nlohmann/json.hpp>

#include "modules/gameplay/actions/domain/GameAction.h"
#include "modules/gameplay/cards/domain/GameCard.h"
#include "modules/gameplay/dice/domain/GameDiceState.h"
#include "modules/gameplay/state/domain/GameLine.h"
#include "modules/gameplay/prompts/domain/GamePrompt.h"
#include "modules/gameplay/pawn_selection/domain/PawnSelection.h"
#include "modules/gameplay/shortcuts/domain/GameShortcut.h"

namespace lila::modules::gameplay::domain
{
struct GameState final
{
    int roomId = 0;
    int version = 0;
    int turnIndex = 0;
    std::string gameType;
    std::string gameName;
    std::string status;
    std::string phase;
    std::string turnLabel;
    std::string currentPlayerLabel;
    std::vector<GameAction> actions;
    std::vector<GameCard> hand;
    std::optional<GameDiceState> dice;
    std::vector<GameShortcut> shortcuts;
    std::vector<GameLine> lines;
    std::optional<GamePrompt> prompt;
    std::optional<PawnSelection> pawnSelection;
    std::vector<std::string> logMessages;
    nlohmann::json metadata = nlohmann::json::object();
    nlohmann::json extras = nlohmann::json::object();
    nlohmann::json raw = nlohmann::json::object();
};
}
