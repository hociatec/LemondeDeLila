#include "modules/gameplay/dice/application/GameDiceTextBuilder.h"

namespace lila::modules::gameplay::application::dice
{
std::string GameDiceTextBuilder::DieText(const domain::GameDie& die)
{
    if (!die.value.has_value()) return die.label;
    return die.label + " : " + std::to_string(*die.value) + " sur " + std::to_string(die.sides);
}

std::string GameDiceTextBuilder::TotalText(const domain::GameDiceState& state)
{
    return state.total.has_value()
        ? "Résultat du lancer : " + std::to_string(*state.total)
        : state.label;
}
}
