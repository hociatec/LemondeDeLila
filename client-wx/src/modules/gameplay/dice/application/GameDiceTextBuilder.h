#pragma once

#include <string>

#include "modules/gameplay/dice/domain/GameDiceState.h"

namespace lila::modules::gameplay::application::dice
{
class GameDiceTextBuilder final
{
public:
    [[nodiscard]] static std::string DieText(const domain::GameDie& die);
    [[nodiscard]] static std::string TotalText(const domain::GameDiceState& state);
};
}
