#include "modules/gameplay/information/application/GameKnownCapabilityText.h"

#include <algorithm>
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

void AppendPosition(
    std::ostringstream& out,
    const domain::GameState& state,
    const domain::GameMovementTrack& track,
    const std::string& entity,
    int position,
    bool includeTrack)
{
    if (includeTrack) out << "Piste " << track.id << " — ";
    try { out << Player(state, std::stoi(entity)); }
    catch (const std::exception&) { out << entity; }
    out << " : case " << position << ".\n";
}
}

std::optional<std::string> BuildBoardCapabilityText(
    const domain::GameState& state, const std::string& capability)
{
    std::ostringstream out;
    if (capability == "position" && state.kits.movement)
    {
        if (!state.viewerPlayerId) return "Votre position est indisponible.";
        const auto viewer = std::find_if(
            state.system.players.begin(), state.system.players.end(),
            [&state](const auto& player) { return player.id == *state.viewerPlayerId; });
        if (viewer == state.system.players.end()) return "Votre position est indisponible.";
        const auto entity = std::to_string(*state.viewerPlayerId);
        const bool includeTrack = state.kits.movement->tracks.size() > 1;
        for (const auto& track : state.kits.movement->tracks)
        {
            const auto found = track.positions.find(entity);
            if (includeTrack) out << "Piste " << track.id << " — ";
            out << "Votre position : case "
                << (found == track.positions.end() ? 0 : found->second) << ".\n";
        }
        return out.str().empty() ? "Votre position est indisponible." : out.str();
    }
    if (capability == "positions" && state.kits.movement)
    {
        const bool includeTrack = state.kits.movement->tracks.size() > 1;
        for (const auto& track : state.kits.movement->tracks)
            for (const auto& player : state.system.players)
            {
                const auto entity = std::to_string(player.id);
                const auto found = track.positions.find(entity);
                AppendPosition(out, state, track, entity,
                    found == track.positions.end() ? 0 : found->second, includeTrack);
            }
        return out.str().empty() ? "Les positions sont indisponibles." : out.str();
    }
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
