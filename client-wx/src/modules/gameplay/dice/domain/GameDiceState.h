#pragma once

#include <cstddef>
#include <optional>
#include <string>
#include <vector>

#include "modules/gameplay/dice/domain/GameDie.h"

namespace lila::modules::gameplay::domain
{
struct GameDiceState final
{
    std::string label = "Dés";
    std::vector<GameDie> dice;
    std::optional<int> total;
    std::optional<std::size_t> rollActionIndex;
    std::string rollKey;
};
}
