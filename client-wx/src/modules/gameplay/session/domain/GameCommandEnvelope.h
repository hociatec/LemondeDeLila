#pragma once

#include <string>
#include <vector>

#include "modules/gameplay/actions/domain/GameAction.h"

namespace lila::modules::gameplay::domain
{
struct GameCommandEnvelope final
{
    int roomId = 0;
    std::string gameType;
    std::string commandId;
    int knownVersion = 0;
    std::vector<GameAction> actions;
};
}
