#include "modules/gameplay/dice/application/GameDiceActionResolver.h"

namespace lila::modules::gameplay::application::dice
{
std::optional<domain::GameAction> GameDiceActionResolver::Resolve(
    const domain::GameDiceState& dice,
    const std::vector<domain::GameAction>& actions)
{
    if (!dice.rollActionIndex.has_value() || *dice.rollActionIndex >= actions.size())
        return std::nullopt;
    const auto& action = actions[*dice.rollActionIndex];
    return action.disabled ? std::nullopt : std::optional<domain::GameAction>(action);
}

}
