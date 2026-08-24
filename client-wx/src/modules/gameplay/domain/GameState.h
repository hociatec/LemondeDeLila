#pragma once

#include <string>
#include <optional>
#include <vector>

#include <nlohmann/json.hpp>

#include "modules/gameplay/domain/GameAction.h"
#include "modules/gameplay/domain/GameLine.h"
#include "modules/gameplay/domain/GamePrompt.h"
#include "modules/gameplay/domain/GameShortcut.h"

namespace lila::modules::gameplay::domain
{
struct GameState final
{
    int roomId = 0;
    int version = 0;
    std::string gameType;
    std::string gameName;
    std::string status;
    std::string phase;
    std::string turnLabel;
    std::string currentPlayerLabel;
    std::vector<GameAction> actions;
    std::vector<GameShortcut> shortcuts;
    std::vector<GameLine> lines;
    std::optional<GamePrompt> prompt;
    std::vector<std::string> logMessages;
    nlohmann::json metadata = nlohmann::json::object();
    nlohmann::json extras = nlohmann::json::object();
    nlohmann::json raw = nlohmann::json::object();
};
}
