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
    nlohmann::json value;
    std::optional<GameAction> action;
};

struct GamePending final
{
    std::string type;
    std::string label;
    std::string question;
    std::string choiceId;
    std::string workflowKind;
    std::optional<int> playerId;
    std::optional<int> targetPlayerId;
    std::vector<int> playerIds;
    std::vector<int> resolvedPlayerIds;
    bool blocking = false;
    bool viewerActionable = false;
    bool multipleSelection = false;
    int minimumSelections = 1;
    int maximumSelections = 1;
    std::optional<GameAction> selectionAction;
    std::vector<GamePendingChoice> choices;
    nlohmann::json data = nlohmann::json::object();
};
}
