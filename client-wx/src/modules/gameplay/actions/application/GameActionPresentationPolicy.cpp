#include "modules/gameplay/actions/application/GameActionPresentationPolicy.h"

#include <cstddef>
#include <optional>
#include <vector>

#include "modules/gameplay/cards/application/GameCardActionResolver.h"
#include "modules/gameplay/dice/application/GameDiceActionResolver.h"

namespace lila::modules::gameplay::application
{
namespace
{
void Mark(std::vector<bool>& represented, std::optional<std::size_t> index)
{
    if (index.has_value() && *index < represented.size()) represented[*index] = true;
}
}

std::vector<domain::GameLine> GameActionPresentationPolicy::GenericLines(
    const domain::GameState& state)
{
    std::vector<bool> represented(state.actions.size(), false);
    for (std::size_t index = 0; index < state.hand.size(); ++index)
    {
        Mark(
            represented,
            cards::GameCardActionResolver::ResolveIndex(
                state.hand, state.actions, index));
    }

    if (state.dice.has_value())
    {
        const auto count = state.dice->dice.empty()
            ? std::size_t{1}
            : state.dice->dice.size();
        for (std::size_t index = 0; index < count; ++index)
        {
            const auto actionIndex = dice::GameDiceActionResolver::ResolveIndex(
                *state.dice, state.actions, index);
            Mark(represented, actionIndex);
        }
    }

    std::vector<domain::GameLine> lines;
    lines.reserve(state.lines.size());
    for (const auto& line : state.lines)
    {
        if (line.actionIndex >= represented.size() || !represented[line.actionIndex])
            lines.push_back(line);
    }
    return lines;
}
}
