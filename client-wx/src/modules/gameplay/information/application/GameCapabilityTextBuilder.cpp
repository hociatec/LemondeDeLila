#include "modules/gameplay/information/application/GameCapabilityTextBuilder.h"

#include <sstream>

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
    if (capability == "hand")
    {
        const auto count = state.kits.VisibleHand().size();
        return "Vous avez " + std::to_string(count) +
            (count > 1 ? " cartes en main." : " carte en main.");
    }
    if (capability == "current-turn")
    {
        const auto current = state.system.turn.currentPlayerId;
        return !current
            ? "Aucun tour actif."
            : "C'est au tour de " + Player(state, *current) + ".";
    }
    if (capability == "discard")
    {
        if (!state.kits.cards) return "Carte au-dessus indisponible.";
        for (const auto& discard : state.kits.cards->discards)
            if (!discard.cards.empty())
                return "Carte au-dessus : " + discard.cards.back().label + ".";
        return "Aucune carte sur la défausse.";
    }
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
        {
            out << "\nValeurs publiques\n";
            for (const auto& [key, value] : state.system.setup.values)
                out << "  " << HumanLabel(key) << " : " << ValueLines(value, "    ") << '\n';
        }
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
    if (capability == "specific" || capability == "game") return ValueLines(state.game);
    if (const auto* unknown = state.kits.Unknown(capability)) return ValueLines(*unknown);
    return {};
}

}
