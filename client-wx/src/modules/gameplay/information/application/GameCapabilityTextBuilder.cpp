#include "modules/gameplay/information/application/GameCapabilityTextBuilder.h"

#include <sstream>

#include <nlohmann/json.hpp>

namespace lila::modules::gameplay::application::info
{
namespace
{
std::string PlayerLabel(const domain::GameState& state, const std::string& key)
{
    try
    {
        const int id = std::stoi(key);
        for (const auto& player : state.system.players)
            if (player.id == id) return player.username + " (" + key + ")";
    }
    catch (const std::exception&) {}
    return key;
}

std::string ScoreText(const domain::GameState& state)
{
    std::ostringstream out;
    const auto leaderboard = state.kits.score.find("leaderboard");
    if (leaderboard != state.kits.score.end() && leaderboard->is_array())
        for (const auto& entry : *leaderboard)
        {
            if (!entry.is_object()) continue;
            const auto id = entry.value("playerId", 0);
            out << entry.value("rank", 0) << ". "
                << PlayerLabel(state, std::to_string(id)) << " : "
                << entry.value("score", 0) << '\n';
        }
    return out.str();
}

std::string CardsText(const domain::GameState& state)
{
    std::ostringstream out;
    const auto appendZones = [&out](const nlohmann::json& zones, const char* title)
    {
        if (!zones.is_object()) return;
        out << title << "\n";
        for (const auto& zone : zones.items())
            out << "- " << zone.key() << " : "
                << GameCapabilityTextBuilder::JsonLines(zone.value(), "  ");
    };
    appendZones(state.kits.cards.value("decks", nlohmann::json::object()), "Pioches");
    appendZones(state.kits.cards.value("discards", nlohmann::json::object()), "Défausses");
    appendZones(state.kits.cards.value("hands", nlohmann::json::object()), "Mains visibles");
    appendZones(state.kits.cards.value("zones", nlohmann::json::object()), "Zones publiques");
    return out.str();
}
}

std::string GameCapabilityTextBuilder::Build(
    const domain::GameState& state,
    const std::string& capability)
{
    if (capability == "score" || capability == "scores")
    {
        const auto specialized = ScoreText(state);
        return specialized.empty() ? JsonLines(state.kits.score) : specialized;
    }
    if (capability == "cards" || capability == "hand" || capability == "hands" ||
        capability == "deck" || capability == "discard") return CardsText(state);
    if (capability == "players")
    {
        std::ostringstream out;
        for (const auto& player : state.system.players)
            out << player.username << (player.isBot ? " (bot)" : "")
                << (player.alive ? " - actif" : " - éliminé") << '\n';
        return out.str();
    }
    if (capability == "match")
    {
        std::ostringstream out;
        out << "État : " << state.system.match.status;
        if (state.system.match.result)
        {
            out << "\nRésultat : " << state.system.match.result->reason << "\nGagnants : ";
            for (std::size_t index = 0;
                index < state.system.match.result->winnerPlayerIds.size(); ++index)
            {
                if (index > 0) out << ", ";
                out << PlayerLabel(state,
                    std::to_string(state.system.match.result->winnerPlayerIds[index]));
            }
        }
        return out.str();
    }
    if (capability == "round")
    {
        std::ostringstream out;
        out << "Manche " << state.system.round.number << "\nÉtat : "
            << state.system.round.status << "\nManches terminées : "
            << state.system.round.completedRounds;
        if (state.system.round.starterPlayerId)
            out << "\nPremier joueur : " << PlayerLabel(
                state, std::to_string(*state.system.round.starterPlayerId));
        return out.str();
    }
    if (capability == "turn")
    {
        std::ostringstream out;
        out << state.turnLabel << "\nNuméro : " << state.system.turn.number
            << "\nDirection : " << (state.system.turn.direction == 1 ? "horaire" : "antihoraire");
        if (state.system.turn.actionPointsRemaining)
            out << "\nPoints d'action : " << *state.system.turn.actionPointsRemaining;
        if (state.system.turn.extraCount > 0)
            out << "\nTours supplémentaires : " << state.system.turn.extraCount;
        return out.str();
    }
    if (capability == "effect") return JsonLines(state.effect);
    if (capability == "setup")
    {
        std::ostringstream out;
        out << (state.system.setup.complete ? "Configuration terminée" : "Configuration requise")
            << "\nPhase : " << state.system.setup.phase;
        if (state.system.setup.ownerPlayerId)
            out << "\nPropriétaire : " << PlayerLabel(
                state, std::to_string(*state.system.setup.ownerPlayerId));
        if (!state.system.setup.values.empty())
            out << "\nValeurs publiques\n" << JsonLines(state.system.setup.values, "  ");
        return out.str();
    }
    if (capability == "timers") return JsonLines(state.timers);
    if (capability == "specific" || capability == "game") return JsonLines(state.game);
    return JsonLines(state.kits.Get(capability.c_str()));
}

std::string GameCapabilityTextBuilder::JsonLines(
    const nlohmann::json& value,
    const std::string& prefix)
{
    std::ostringstream out;
    if (value.is_object())
    {
        for (const auto& item : value.items())
        {
            if (item.value().is_primitive())
                out << prefix << item.key() << " : " << JsonLines(item.value()) << '\n';
            else
                out << prefix << item.key() << "\n" << JsonLines(item.value(), prefix + "  ");
        }
    }
    else if (value.is_array())
    {
        for (std::size_t index = 0; index < value.size(); ++index)
            out << prefix << "- " << JsonLines(value[index], prefix + "  ");
    }
    else if (value.is_string()) out << value.get<std::string>();
    else if (value.is_boolean()) out << (value.get<bool>() ? "oui" : "non");
    else if (value.is_null()) out << "non renseigné";
    else out << value.dump();
    return out.str();
}
}
