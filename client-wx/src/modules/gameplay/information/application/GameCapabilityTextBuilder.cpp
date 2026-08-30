#include "modules/gameplay/information/application/GameCapabilityTextBuilder.h"

#include <sstream>

#include <nlohmann/json.hpp>

#include "modules/gameplay/information/application/GameKnownCapabilityText.h"
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
}

std::string GameCapabilityTextBuilder::Build(
    const domain::GameState& state, const std::string& capability)
{
    if (const auto text = BuildBoardCapabilityText(state, capability)) return *text;
    if (const auto text = BuildValueCapabilityText(state, capability)) return *text;
    if (const auto text = BuildAssetCapabilityText(state, capability)) return *text;
    if (const auto text = BuildWorkflowCapabilityText(state, capability)) return *text;
    std::ostringstream out;
    if (capability == "players")
    {
        for (const auto& player : state.system.players)
            out << player.username << (player.isBot ? " (bot)" : "")
                << (player.alive ? " — actif" : " — éliminé") << '\n';
        return out.str();
    }
    if (capability == "match")
    {
        out << "État : " << HumanLabel(state.system.match.status);
        if (state.system.match.result)
        {
            out << "\nRésultat : " << HumanLabel(state.system.match.result->reason) << "\nGagnants : ";
            for (std::size_t index = 0; index < state.system.match.result->winnerPlayerIds.size(); ++index)
            {
                if (index > 0) out << ", ";
                out << Player(state, state.system.match.result->winnerPlayerIds[index]);
            }
        }
        return out.str();
    }
    if (capability == "round")
    {
        out << "Manche " << state.system.round.number << "\nÉtat : "
            << HumanLabel(state.system.round.status) << "\nManches terminées : "
            << state.system.round.completedRounds;
        if (state.system.round.starterPlayerId)
            out << "\nPremier joueur : " << Player(state, *state.system.round.starterPlayerId);
        return out.str();
    }
    if (capability == "turn")
    {
        out << (state.system.turn.currentPlayerId
                ? "Tour de " + Player(state, *state.system.turn.currentPlayerId)
                : std::string("Aucun tour actif"))
            << "\nNuméro : " << state.system.turn.number
            << "\nDirection : " << (state.system.turn.direction == 1 ? "horaire" : "antihoraire");
        if (state.system.turn.actionPointsRemaining)
            out << "\nPoints d’action : " << *state.system.turn.actionPointsRemaining;
        if (state.system.turn.extraCount > 0)
            out << "\nTours supplémentaires : " << state.system.turn.extraCount;
        return out.str();
    }
    if (capability == "setup")
    {
        out << (state.system.setup.complete ? "Configuration terminée" : "Configuration requise")
            << "\nPhase : " << HumanLabel(state.system.setup.phase);
        if (state.system.setup.ownerPlayerId)
            out << "\nPropriétaire : " << Player(state, *state.system.setup.ownerPlayerId);
        if (!state.system.setup.values.empty())
            out << "\nValeurs publiques\n" << JsonLines(state.system.setup.values, "  ");
        return out.str();
    }
    if (capability == "effect" && state.effect)
    {
        if (state.effect->sourcePlayerId)
            out << "Source : " << Player(state, *state.effect->sourcePlayerId) << '\n';
        if (!state.effect->sourceCardId.empty()) out << "Carte : " << state.effect->sourceCardId << '\n';
        out << "Résolution : " << (state.effect->resolved ? "terminée" : "en cours");
        return out.str();
    }
    if (capability == "timers")
    {
        for (const auto& timer : state.timers)
            out << (timer.label.empty() ? HumanLabel(timer.id) : timer.label) << " : "
                << timer.remainingMs.value_or(0) / 1000 << " seconde(s) restante(s)"
                << (timer.paused ? " — en pause" : "") << '\n';
        return out.str();
    }
    if (capability == "specific" || capability == "game") return JsonLines(state.game);
    if (const auto* unknown = state.kits.Unknown(capability)) return ValueLines(*unknown);
    return {};
}

std::string GameCapabilityTextBuilder::JsonLines(
    const nlohmann::json& value, const std::string& prefix)
{
    std::ostringstream out;
    if (value.is_object())
        for (const auto& item : value.items())
            if (item.value().is_primitive())
                out << prefix << HumanLabel(item.key()) << " : " << JsonLines(item.value()) << '\n';
            else out << prefix << HumanLabel(item.key()) << '\n'
                     << JsonLines(item.value(), prefix + "  ");
    else if (value.is_array())
        for (const auto& item : value) out << prefix << "- " << JsonLines(item, prefix + "  ");
    else if (value.is_string()) out << value.get<std::string>();
    else if (value.is_boolean()) out << (value.get<bool>() ? "oui" : "non");
    else if (value.is_null()) out << "non renseigné";
    else out << value.dump();
    return out.str();
}
}
