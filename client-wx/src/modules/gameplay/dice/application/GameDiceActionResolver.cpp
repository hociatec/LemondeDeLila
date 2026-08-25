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

bool IsClassicRollActionType(const std::string& type)
{
    return type == "roll" || type == "ROLL_DICE" || type == "roll_dice";
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

std::optional<domain::GameAction> GameDiceActionResolver::ResolveClassicRoll(
    const std::vector<domain::GameAction>& actions)
{
    for (const auto& action : actions)
    {
        if (!action.disabled && IsClassicRollActionType(action.type)) return action;
    }
    return std::nullopt;
}
}
