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
        if (!state.kits.cards->decks.empty())
        {
            out << "Pioches\n";
            for (const auto& deck : state.kits.cards->decks)
                out << "- " << HumanLabel(deck.id) << " : " << deck.count << " carte(s)\n";
        }
        if (!state.kits.cards->discards.empty())
        {
            out << "Défausses\n";
            for (const auto& discard : state.kits.cards->discards)
            {
                out << "- " << HumanLabel(discard.id) << " : " << discard.count << " carte(s)";
                if (!discard.cards.empty())
                {
                    out << " — ";
                    for (std::size_t index = 0; index < discard.cards.size(); ++index)
                    {
                        if (index > 0) out << ", ";
                        out << discard.cards[index].label;
                    }
                }
                out << '\n';
            }
        }
        if (!state.kits.cards->hands.empty())
        {
            out << "Mains\n";
            for (const auto& hand : state.kits.cards->hands)
                for (const auto& player : hand.players)
                    out << "- " << HumanLabel(hand.id) << ", " << Player(state, player.playerId)
                        << " : " << player.count << " carte(s)"
                        << (player.cardsVisible ? " visibles" : " masquées") << '\n';
        }
        if (!state.kits.cards->zones.empty())
        {
            out << "Zones de cartes\n";
            for (const auto& zone : state.kits.cards->zones)
            {
                out << "- " << HumanLabel(zone.id) << " : " << zone.count << " carte(s)"
                    << (zone.cardsVisible ? " visibles" : " masquées");
                if (!zone.cards.empty())
                {
                    out << " — ";
                    for (std::size_t index = 0; index < zone.cards.size(); ++index)
                    {
                        if (index > 0) out << ", ";
                        out << zone.cards[index].label;
                    }
                }
                out << '\n';
            }
        }
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
