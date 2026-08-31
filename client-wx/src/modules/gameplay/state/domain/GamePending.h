#pragma once

#include <optional>
#include <string>
#include <vector>

#include "modules/gameplay/actions/domain/GameAction.h"
#include "modules/gameplay/prompts/domain/GamePrompt.h"
#include "modules/gameplay/state/domain/GameValue.h"

namespace lila::modules::gameplay::domain
{
struct GamePendingChoice final
{
    std::string label;
    GameValue value;
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
    bool ordering = false;
    int minimumSelections = 1;
    int maximumSelections = 1;
    std::optional<GameAction> selectionAction;
    std::optional<GamePrompt> prompt;
    std::vector<GamePendingChoice> choices;
    GameValue::Object unknownData;
};
}
