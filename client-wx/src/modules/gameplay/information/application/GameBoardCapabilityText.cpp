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
    if (capability == "position" && state.kits.pawns)
    {
        if (!state.viewerPlayerId) return "Vos pions sont indisponibles.";
        for (const auto& pawn : state.kits.pawns->pawns)
        {
            if (pawn.ownerId != state.viewerPlayerId) continue;
            out << pawn.label << " : ";
            if (pawn.position < 0) out << "en réserve";
            else out << "case " << pawn.position + 1;
            out << ".\n";
        }
        return out.str().empty() ? "Vos pions sont indisponibles." : out.str();
    }
    if (capability == "positions" && state.kits.pawns)
    {
        for (const auto& pawn : state.kits.pawns->pawns)
        {
            if (!pawn.ownerId || pawn.ownerId == state.viewerPlayerId) continue;
            out << Player(state, *pawn.ownerId) << " — " << pawn.label << " : ";
            if (pawn.position < 0) out << "en réserve";
            else out << "case " << pawn.position + 1;
            out << ".\n";
        }
        return out.str().empty() ? "Les pions adverses sont indisponibles." : out.str();
    }
    if (capability == "race-ranking" && state.kits.movement)
    {
        for (const auto& track : state.kits.movement->tracks)
        {
            out << "Classement de la course";
            if (state.kits.movement->tracks.size() > 1) out << " — " << track.id;
            out << '\n';
            std::vector<std::pair<int, int>> ranked;
            for (const auto& player : state.system.players)
            {
                const auto found = track.positions.find(std::to_string(player.id));
                ranked.emplace_back(player.id, found == track.positions.end() ? 0 : found->second);
            }
            std::stable_sort(ranked.begin(), ranked.end(),
                [](const auto& left, const auto& right) { return left.second > right.second; });
            std::size_t rank = 0;
            for (std::size_t index = 0; index < ranked.size(); ++index)
            {
                const auto [playerId, position] = ranked[index];
                if (index == 0 || ranked[index - 1].second != position) rank = index + 1;
                const auto remaining = std::max(0, track.spaces - 1 - position);
                out << "Rang " << rank << " — " << Player(state, playerId) << " : ";
                if (remaining == 0) out << "arrivée atteinte";
                else out << remaining << (remaining == 1 ? " case" : " cases") << " avant l'arrivée";
                out << ".\n";
            }
        }
        return out.str();
    }
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
