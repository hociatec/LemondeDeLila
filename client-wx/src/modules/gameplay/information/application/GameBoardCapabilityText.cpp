#include "modules/gameplay/information/application/GameKnownCapabilityText.h"

#include <sstream>

namespace lila::modules::gameplay::application::info
{
namespace
{
std::string Player(const domain::GameState& state, int id)
{
    for (const auto& player : state.system.players)
        if (player.id == id) return player.username;
    return "Joueur " + std::to_string(id);
}
}

std::optional<std::string> BuildBoardCapabilityText(
    const domain::GameState& state, const std::string& capability)
{
    std::ostringstream out;
    if (capability == "movement" && state.kits.movement)
    {
        for (const auto& track : state.kits.movement->tracks)
        {
            out << "Piste " << track.id;
            if (track.spaces > 0) out << " — " << track.spaces << " cases";
            out << '\n';
            for (const auto& [entity, position] : track.positions)
            {
                try { out << "- " << Player(state, std::stoi(entity)); }
                catch (const std::exception&) { out << "- " << entity; }
                out << " : case " << position;
                if (track.spaces > 1)
                    out << ", progression " << (100 * position / (track.spaces - 1)) << " %";
                out << '\n';
            }
        }
        return out.str();
    }
    if (capability == "pawns" && state.kits.pawns)
    {
        for (const auto& pawn : state.kits.pawns->pawns)
        {
            out << pawn.label << ", position " << pawn.position;
            if (pawn.ownerId) out << ", pion de " << Player(state, *pawn.ownerId);
            out << " — ensemble " << pawn.setId << '\n';
        }
        return out.str();
    }
    if (capability == "grid" && state.kits.grid)
    {
        for (const auto& board : state.kits.grid->boards)
            out << "Plateau " << board.id << " : " << board.width << " colonnes sur "
                << board.height << " lignes, " << board.overlays.size() << " élément(s) superposé(s).\n";
        return out.str();
    }
    return std::nullopt;
}
}
