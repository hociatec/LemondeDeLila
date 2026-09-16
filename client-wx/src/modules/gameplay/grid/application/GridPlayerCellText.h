#pragma once

#include <algorithm>
#include <string>
#include <vector>

#include "modules/gameplay/grid/application/GameGridCoordinate.h"
#include "modules/gameplay/state/domain/GameCapabilities.h"
#include "modules/gameplay/state/domain/GameSystem.h"

namespace lila::modules::gameplay::application::grid
{
inline std::string GridPlayerCellText(const domain::GameGridCellView& cell,
    const std::vector<domain::GamePlayer>& players)
{
    const auto coordinate = GridCoordinate(cell.x, cell.y);
    if (!cell.occupied) return coordinate;
    const auto player = std::find_if(players.begin(), players.end(),
        [&cell](const domain::GamePlayer& value) {
            return cell.ownerId && value.id == *cell.ownerId;
        });
    return coordinate + ", " + (player != players.end() && !player->username.empty()
        ? player->username : cell.ownerId
        ? "joueur " + std::to_string(*cell.ownerId) : "joueur inconnu");
}
}
