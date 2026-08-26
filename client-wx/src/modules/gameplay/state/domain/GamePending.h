#pragma once

#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "modules/gameplay/actions/domain/GameAction.h"

namespace lila::modules::gameplay::domain
{
struct GamePendingChoice final
{
    std::string label;
    std::optional<GameAction> action;
};

struct GamePending final
{
    std::string type;
    std::string label;
    std::string question;
    std::optional<int> playerId;
    std::optional<int> targetPlayerId;
    bool blocking = false;
    bool viewerActionable = false;
    std::vector<GamePendingChoice> choices;
    nlohmann::json data = nlohmann::json::object();
};
}
