#pragma once

#include <optional>

#include "modules/gameplay/dice/application/GameDiceActionResolver.h"
#include "modules/gameplay/state/domain/GameState.h"

namespace lila::modules::gameplay::application
{
class GameZoneActionResolver final
{
public:
    [[nodiscard]] static std::optional<domain::GameAction> Resolve(
        const domain::GameState& state)
    {
        const auto* dice = state.kits.Dice();
        return dice == nullptr
            ? std::nullopt
            : dice::GameDiceActionResolver::Resolve(*dice, state.actions);
    }
};
}
