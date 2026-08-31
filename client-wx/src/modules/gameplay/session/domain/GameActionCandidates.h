#pragma once

#include <optional>
#include <string>
#include <vector>

#include "modules/gameplay/actions/domain/GameAction.h"
#include "modules/gameplay/state/domain/GameValue.h"

namespace lila::modules::gameplay::domain
{
struct GameActionCandidatesRequest final
{
    std::string actionType;
    GameValue::Object query;
    int offset = 0;
    int limit = 50;
};

struct GameActionCandidatesResult final
{
    int roomId = 0;
    std::string gameType;
    std::string actionType;
    std::vector<GameAction> items;
    int offset = 0;
    int limit = 50;
    std::optional<int> nextOffset;
};
}
