#include "modules/gameplay/grid/application/GameGridActionResolver.h"

#include <algorithm>

namespace lila::modules::gameplay::application::grid
{
bool GameGridActionResolver::Targets(
    const domain::GameAction& action, const GameGridTarget& target)
{
    if (action.disabled || !action.payload.is_object()) return false;
    const auto board = action.payload.find("boardId");
    if (board != action.payload.end() &&
        (!board->is_string() || board->get<std::string>() != target.boardId)) return false;
    const auto cellId = action.payload.find("cellId");
    if (cellId != action.payload.end())
        return cellId->is_string() && cellId->get<std::string>() == target.cellId;
    const auto position = action.payload.find("position");
    const auto& coordinates = position != action.payload.end() && position->is_object()
        ? *position : action.payload;
    const auto x = coordinates.find("x");
    const auto y = coordinates.find("y");
    return x != coordinates.end() && y != coordinates.end() &&
        x->is_number_integer() && y->is_number_integer() &&
        x->get<int>() == target.x && y->get<int>() == target.y;
}

std::optional<domain::GameAction> GameGridActionResolver::Resolve(
    const std::vector<domain::GameAction>& actions, const GameGridTarget& target)
{
    const auto found = std::find_if(actions.begin(), actions.end(),
        [&target](const domain::GameAction& action) { return Targets(action, target); });
    return found == actions.end() ? std::nullopt : std::optional<domain::GameAction>(*found);
}
}
