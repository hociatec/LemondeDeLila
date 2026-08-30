#include "modules/gameplay/information/application/GameKnownCapabilityText.h"

#include <cmath>
#include <sstream>

#include "modules/gameplay/information/application/GameValueTextBuilder.h"

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

void Amount(std::ostringstream& out, double value)
{
    if (std::trunc(value) == value) out << static_cast<long long>(value);
    else out << value;
}
}

std::optional<std::string> BuildValueCapabilityText(
    const domain::GameState& state, const std::string& capability)
{
    std::ostringstream out;
    if ((capability == "score" || capability == "scores") && state.kits.score)
    {
        for (const auto& entry : state.kits.score->leaderboard)
        {
            out << entry.rank << ". " << Player(state, entry.playerId) << " : ";
            Amount(out, entry.score);
            out << '\n';
        }
        return out.str();
    }
    if (capability == "resources" && state.kits.resources)
    {
        for (const auto& player : state.kits.resources->players)
        {
            out << Player(state, player.playerId) << '\n';
            for (const auto& value : player.values)
            {
                out << "- " << HumanLabel(value.id) << " : "; Amount(out, value.value); out << '\n';
            }
        }
        return out.str();
    }
    if (capability == "counters" && state.kits.counters)
    {
        for (const auto& value : state.kits.counters->values)
        {
            out << HumanLabel(value.id) << " : "; Amount(out, value.value); out << '\n';
        }
        return out.str();
    }
    if (capability == "status" && state.kits.status)
    {
        for (const auto& value : state.kits.status->values)
        {
            out << Player(state, value.playerId) << " : " << HumanLabel(value.id);
            if (value.remaining) out << ", durée restante " << *value.remaining;
            if (!value.scope.empty()) out << ", portée " << HumanLabel(value.scope);
            out << '\n';
        }
        return out.str();
    }
    if (capability == "cards" && state.kits.cards)
    {
        out << "Main visible : " << state.kits.cards->visibleHand.size() << " carte(s).\n";
        if (!state.kits.cards->decks.Empty()) out << "Pioches\n" << ValueLines(state.kits.cards->decks, "  ");
        if (!state.kits.cards->discards.Empty()) out << "Défausses\n" << ValueLines(state.kits.cards->discards, "  ");
        if (!state.kits.cards->zones.Empty()) out << "Zones publiques\n" << ValueLines(state.kits.cards->zones, "  ");
        return out.str();
    }
    if (capability == "dice" && state.kits.dice)
    {
        out << "Dés : " << state.kits.dice->dice.size();
        if (state.kits.dice->total) out << "\nTotal : " << *state.kits.dice->total;
        return out.str();
    }
    return std::nullopt;
}
}
