#pragma once

#include <string>
#include <optional>
#include <vector>

#include <nlohmann/json.hpp>

#include "modules/gameplay/actions/domain/GameAction.h"
#include "modules/gameplay/cards/domain/GameCard.h"
#include "modules/gameplay/dice/domain/GameDiceState.h"
#include "modules/gameplay/state/domain/GameLine.h"
#include "modules/gameplay/state/domain/GamePending.h"
#include "modules/gameplay/state/domain/GameSystem.h"
#include "modules/gameplay/state/domain/GameKits.h"
#include "modules/gameplay/prompts/domain/GamePrompt.h"
#include "modules/gameplay/pawn_selection/domain/PawnSelection.h"
#include "modules/gameplay/shortcuts/domain/GameShortcut.h"

namespace lila::modules::gameplay::domain
{
struct GameState final
{
    static constexpr int SupportedViewVersion = 1;

    int roomId = 0;
    int runId = 0;
    int version = 0;
    int viewVersion = 0;
    int turnIndex = 0;
    int round = 0;
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
    std::optional<GamePending> pending;
    std::optional<GamePrompt> prompt;
    std::optional<PawnSelection> pawnSelection;
    std::vector<std::string> logMessages;
    GameSystem system;
    GameKits kits;
    nlohmann::json effect = nlohmann::json::object();
    nlohmann::json game = nlohmann::json::object();
    nlohmann::json actionCatalog = nlohmann::json::array();
    nlohmann::json timers = nlohmann::json::object();
};
}
