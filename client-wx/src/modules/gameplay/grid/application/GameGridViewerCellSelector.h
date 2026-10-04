#pragma once

#include <optional>
#include <string>

#include "modules/gameplay/state/domain/GameBoardCapabilities.h"

namespace lila::modules::gameplay::application::grid
{
struct GameGridCellSelection final
{
    std::string boardId;
    std::string cellId;
};

class GameGridViewerCellSelector final
{
public:
    [[nodiscard]] static std::optional<GameGridCellSelection> Select(
        const domain::GameGridView* grid,
        const std::optional<int>& viewerPlayerId) noexcept
    {
        if (grid == nullptr || !viewerPlayerId) return std::nullopt;
        for (const auto& board : grid->boards)
            for (const auto& cell : board.cells)
                if (cell.ownerId == viewerPlayerId)
                    return GameGridCellSelection{board.id, cell.id};
        return std::nullopt;
    }
};
}
