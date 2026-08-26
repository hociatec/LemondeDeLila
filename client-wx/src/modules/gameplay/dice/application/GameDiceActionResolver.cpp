#include "modules/gameplay/dice/application/GameDiceActionResolver.h"

namespace lila::modules::gameplay::application::dice
{
namespace
{
std::optional<std::size_t> ValidIndex(
    const std::vector<domain::GameAction>& actions,
    std::optional<std::size_t> index)
{
    if (!index.has_value() || *index >= actions.size() || actions[*index].disabled)
        return std::nullopt;
    return index;
}

bool IsClassicRollActionType(const std::string& type)
{
    return type == "roll" || type == "ROLL_DICE" || type == "roll_dice";
}
}

std::optional<std::size_t> GameDiceActionResolver::ResolveIndex(
    const domain::GameDiceState& dice,
    const std::vector<domain::GameAction>& actions,
    std::size_t selectedDie)
{
    if (selectedDie < dice.dice.size())
    {
        const auto& die = dice.dice[selectedDie];
        if (die.disabled) return std::nullopt;
        if (auto index = ValidIndex(actions, die.actionIndex)) return index;
    }
    return ValidIndex(actions, dice.rollActionIndex);
}

std::optional<domain::GameAction> GameDiceActionResolver::Resolve(
    const domain::GameDiceState& dice,
    const std::vector<domain::GameAction>& actions,
    std::size_t selectedDie)
{
    const auto index = ResolveIndex(dice, actions, selectedDie);
    return index.has_value()
        ? std::optional<domain::GameAction>(actions[*index])
        : std::nullopt;
}

std::optional<std::size_t> GameDiceActionResolver::ResolveClassicRollIndex(
    const std::vector<domain::GameAction>& actions)
{
    for (std::size_t index = 0; index < actions.size(); ++index)
    {
        if (!actions[index].disabled && IsClassicRollActionType(actions[index].type))
            return index;
    }
    return std::nullopt;
}

std::optional<domain::GameAction> GameDiceActionResolver::ResolveClassicRoll(
    const std::vector<domain::GameAction>& actions)
{
    const auto index = ResolveClassicRollIndex(actions);
    return index.has_value()
        ? std::optional<domain::GameAction>(actions[*index])
        : std::nullopt;
}
}
