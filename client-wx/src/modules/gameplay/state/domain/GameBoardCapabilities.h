#pragma once

#include <map>
#include <optional>
#include <string>
#include <vector>

namespace lila::modules::gameplay::domain
{
struct GameMovementTrack final
{
    std::string id;
    int spaces = 0;
    std::string overshoot;
    std::map<std::string, int> positions;
};
struct GameMovementView final { std::vector<GameMovementTrack> tracks; };
struct GamePawnView final
{
    std::string setId;
    std::string id;
    std::string label;
    std::optional<int> ownerId;
    int position = 0;
};
struct GamePawnsView final { std::vector<GamePawnView> pawns; };
struct GameGridCellView final
{
    std::string boardId;
    std::string id;
    int x = 0;
    int y = 0;
    bool blocked = false;
    bool occupied = false;
    std::string kind;
    std::string entityId;
    std::string pawnId;
    std::optional<int> ownerId;
    std::string label;
};
struct GameGridOverlayView final
{
    std::string boardId;
    std::string layer;
    std::string kind;
    std::string cellId;
    std::string fromCellId;
    std::string toCellId;
    std::optional<int> ownerId;
    std::string label;
};
struct GameGridBoardView final
{
    std::string id;
    int width = 1;
    int height = 1;
    std::vector<GameGridCellView> cells;
    std::vector<GameGridOverlayView> overlays;
};
struct GameGridView final { std::vector<GameGridBoardView> boards; };
}
