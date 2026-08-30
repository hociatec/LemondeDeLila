#include "modules/gameplay/state/infrastructure/GameBoardCapabilitiesDecoder.h"

#include <algorithm>

#include <nlohmann/json.hpp>

#include "modules/gameplay/state/infrastructure/GamePayloadJsonReader.h"

namespace lila::modules::gameplay::infrastructure
{
namespace
{
std::optional<int> Integer(const nlohmann::json& raw, const char* key)
{
    const auto found = raw.find(key);
    if (found == raw.end() || !found->is_number_integer()) return std::nullopt;
    return found->get<int>();
}

std::string PrimitiveId(const nlohmann::json& raw, const char* key)
{
    const auto found = raw.find(key);
    if (found == raw.end()) return {};
    if (found->is_string()) return found->get<std::string>();
    if (found->is_number_integer()) return std::to_string(found->get<long long>());
    return {};
}

std::map<std::string, int> Positions(const nlohmann::json& raw)
{
    std::map<std::string, int> result;
    if (!raw.is_object()) return result;
    for (const auto& item : raw.items())
        if (item.value().is_number_integer())
            result.emplace(item.key(), item.value().get<int>());
    return result;
}
}

std::optional<domain::GameMovementView> GameBoardCapabilitiesDecoder::Movement(
    const nlohmann::json& raw)
{
    const auto tracks = raw.find("tracks");
    if (tracks == raw.end() || !tracks->is_object() || tracks->empty()) return std::nullopt;
    domain::GameMovementView result;
    for (const auto& item : tracks->items())
    {
        if (!item.value().is_object()) continue;
        domain::GameMovementTrack track;
        track.id = item.key();
        track.spaces = detail::ReadInt(item.value(), "spaces");
        track.overshoot = detail::ReadString(item.value(), "overshoot");
        track.positions = Positions(item.value().value("positions", nlohmann::json::object()));
        result.tracks.push_back(std::move(track));
    }
    return result.tracks.empty() ? std::nullopt
                                 : std::optional<domain::GameMovementView>(std::move(result));
}

std::optional<domain::GamePawnsView> GameBoardCapabilitiesDecoder::Pawns(
    const nlohmann::json& raw)
{
    const auto sets = raw.find("sets");
    if (sets == raw.end() || !sets->is_object() || sets->empty()) return std::nullopt;
    domain::GamePawnsView result;
    for (const auto& set : sets->items())
    {
        if (!set.value().is_object()) continue;
        const auto positions = Positions(set.value().value("positions", nlohmann::json::object()));
        const auto owners = set.value().value("owners", nlohmann::json::object());
        std::map<std::string, std::string> labels;
        const auto definitions = set.value().find("definitions");
        if (definitions != set.value().end() && definitions->is_array())
            for (const auto& definition : *definitions)
                if (definition.is_object())
                {
                    const auto id = PrimitiveId(definition, "id");
                    auto label = detail::ReadString(definition, "label");
                    if (label.empty()) label = detail::ReadString(definition, "name");
                    if (!id.empty()) labels[id] = std::move(label);
                }
        for (const auto& [pawnId, position] : positions)
        {
            domain::GamePawnView pawn;
            pawn.setId = set.key();
            pawn.id = pawnId;
            pawn.label = labels[pawnId].empty() ? pawnId : labels[pawnId];
            pawn.position = position;
            if (owners.is_object())
            {
                const auto owner = owners.find(pawnId);
                if (owner != owners.end() && owner->is_number_integer())
                    pawn.ownerId = owner->get<int>();
            }
            result.pawns.push_back(std::move(pawn));
        }
    }
    return result.pawns.empty() ? std::nullopt
                                : std::optional<domain::GamePawnsView>(std::move(result));
}

std::optional<domain::GameGridView> GameBoardCapabilitiesDecoder::Grid(
    const nlohmann::json& raw)
{
    const auto boards = raw.find("boards");
    if (boards == raw.end() || !boards->is_object() || boards->empty()) return std::nullopt;
    domain::GameGridView result;
    for (const auto& item : boards->items())
    {
        if (!item.value().is_object()) continue;
        domain::GameGridBoardView board;
        board.id = item.key();
        board.width = std::max(1, detail::ReadInt(item.value(), "width"));
        board.height = std::max(1, detail::ReadInt(item.value(), "height"));
        const auto rawCells = item.value().value("cells", nlohmann::json::object());
        for (int y = 0; y < board.height; ++y)
            for (int x = 0; x < board.width; ++x)
            {
                domain::GameGridCellView cell;
                cell.boardId = board.id;
                cell.id = std::to_string(x) + "," + std::to_string(y);
                cell.x = x;
                cell.y = y;
                const auto found = rawCells.is_object() ? rawCells.find(cell.id) : rawCells.end();
                if (rawCells.is_object() && found != rawCells.end())
                {
                    if (found->is_object())
                    {
                        cell.blocked = detail::ReadBool(*found, "blocked") || detail::ReadBool(*found, "wall");
                        cell.occupied = detail::ReadBool(*found, "occupied") || !found->empty();
                        cell.kind = detail::ReadString(*found, "kind");
                        cell.entityId = PrimitiveId(*found, "entityId");
                        if (cell.entityId.empty()) cell.entityId = PrimitiveId(*found, "entity");
                        cell.pawnId = PrimitiveId(*found, "pawnId");
                        cell.ownerId = Integer(*found, "ownerId");
                        cell.label = detail::ReadString(*found, "label");
                    }
                    else cell.occupied = !found->is_null();
                }
                board.cells.push_back(std::move(cell));
            }
        const auto layers = item.value().value("overlays", nlohmann::json::object());
        if (layers.is_object())
            for (const auto& layer : layers.items())
                if (layer.value().is_array())
                    for (const auto& rawOverlay : layer.value())
                    {
                        if (!rawOverlay.is_object()) continue;
                        domain::GameGridOverlayView overlay;
                        overlay.boardId = board.id;
                        overlay.layer = layer.key();
                        overlay.kind = detail::ReadString(rawOverlay, "kind");
                        overlay.cellId = PrimitiveId(rawOverlay, "cellId");
                        if (overlay.cellId.empty()) overlay.cellId = PrimitiveId(rawOverlay, "tileId");
                        overlay.fromCellId = PrimitiveId(rawOverlay, "from");
                        overlay.toCellId = PrimitiveId(rawOverlay, "to");
                        overlay.ownerId = Integer(rawOverlay, "ownerId");
                        overlay.label = detail::ReadString(rawOverlay, "label");
                        board.overlays.push_back(std::move(overlay));
                    }
        result.boards.push_back(std::move(board));
    }
    return result.boards.empty() ? std::nullopt
                                 : std::optional<domain::GameGridView>(std::move(result));
}
}
