#pragma once

#include <cstddef>
#include <optional>
#include <vector>

#include "modules/gameplay/actions/domain/GameAction.h"
#include "modules/gameplay/dice/domain/GameDiceState.h"

namespace lila::modules::gameplay::application::dice
{
class GameDiceActionResolver final
{
public:
    [[nodiscard]] static std::optional<std::size_t> ResolveIndex(
        const domain::GameDiceState& dice,
        const std::vector<domain::GameAction>& actions,
        std::size_t selectedDie);
    [[nodiscard]] static std::optional<domain::GameAction> Resolve(
        const domain::GameDiceState& dice,
        const std::vector<domain::GameAction>& actions,
        std::size_t selectedDie);
};
}
