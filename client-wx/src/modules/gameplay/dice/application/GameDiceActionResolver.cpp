#include "modules/gameplay/dice/application/GameDiceActionResolver.h"

namespace lila::modules::gameplay::application::dice
{
namespace
{
std::optional<domain::GameAction> At(
    const std::vector<domain::GameAction>& actions,
    std::optional<std::size_t> index)
{
    if (!index.has_value() || *index >= actions.size() || actions[*index].disabled)
        return std::nullopt;
    return actions[*index];
}
}

std::optional<domain::GameAction> GameDiceActionResolver::Resolve(
    const domain::GameDiceState& dice,
    const std::vector<domain::GameAction>& actions,
    std::size_t selectedDie)
{
    if (selectedDie < dice.dice.size())
    {
        const auto& die = dice.dice[selectedDie];
        if (die.disabled) return std::nullopt;
        if (auto action = At(actions, die.actionIndex)) return action;
    }
    return At(actions, dice.rollActionIndex);
}
}
