#pragma once

#include <string>
#include <vector>

#include "modules/gameplay/actions/domain/GameAction.h"

namespace lila::modules::gameplay::domain
{
struct PawnChoice final
{
    std::string label;
    GameAction action;
};

struct PawnSelection final
{
    std::string pendingType;
    std::string label;
    std::vector<PawnChoice> choices;
};
}
