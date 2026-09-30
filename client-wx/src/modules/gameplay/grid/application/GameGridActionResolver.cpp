#include "modules/gameplay/grid/application/GameGridActionResolver.h"

#include <algorithm>

namespace lila::modules::gameplay::application::grid
{
bool GameGridActionResolver::Targets(
    const domain::GameAction& action, const GameGridTarget& target)
{
    if (action.disabled) return false;
    // An oriented edge is a wall placement, not a move onto the cell.
    if (action.payload.contains("orientation")) return false;
    const auto board = action.payload.find("boardId");
    if (board != action.payload.end())
    {
        const auto* boardId = board->second.Text();
        if (boardId == nullptr || *boardId != target.boardId) return false;
    }
    const auto cellId = action.payload.find("cellId");
    if (cellId != action.payload.end())
    {
        const auto* id = cellId->second.Text();
        return id != nullptr && *id == target.cellId;
    }
    const auto position = action.payload.find("position");
    const auto* nested = position == action.payload.end()
        ? nullptr : position->second.ObjectValue();
    const auto& coordinates = nested == nullptr ? action.payload : *nested;
    const auto x = coordinates.find("x");
    const auto y = coordinates.find("y");
    return x != coordinates.end() && y != coordinates.end() &&
        x->second.Integer() == target.x && y->second.Integer() == target.y;
}

std::optional<domain::GameAction> GameGridActionResolver::Resolve(
    const std::vector<domain::GameAction>& actions, const GameGridTarget& target)
{
    const auto found = std::find_if(actions.begin(), actions.end(),
        [&target](const domain::GameAction& action) { return Targets(action, target); });
    return found == actions.end() ? std::nullopt : std::optional<domain::GameAction>(*found);
}
}
