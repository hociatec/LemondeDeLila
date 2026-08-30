#include "modules/gameplay/information/application/GameKnownCapabilityText.h"

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

void Players(std::ostringstream& out, const domain::GameState& state,
    const std::vector<int>& ids)
{
    for (std::size_t index = 0; index < ids.size(); ++index)
    {
        if (index > 0) out << ", ";
        out << Player(state, ids[index]);
    }
}
}

std::optional<std::string> BuildWorkflowCapabilityText(
    const domain::GameState& state, const std::string& capability)
{
    std::ostringstream out;
    if (capability == "quiz" && state.kits.quiz)
    {
        for (const auto& session : state.kits.quiz->sessions)
        {
            out << "Quiz " << session.id << " — " << HumanLabel(session.phase) << '\n';
            if (!session.prompt.empty()) out << session.prompt << '\n';
            for (std::size_t index = 0; index < session.choices.size(); ++index)
                out << index + 1 << ". " << session.choices[index]
                    << (session.correctAnswerIndex == static_cast<int>(index) ? " — réponse correcte" : "") << '\n';
            out << "Réponses reçues : "; Players(out, state, session.answeredPlayerIds); out << '\n';
        }
        for (const auto& bank : state.kits.quiz->banks)
            out << "Banque " << HumanLabel(bank.id) << " : " << bank.remaining
                << " question(s) restante(s) sur " << bank.count << '\n';
        return out.str();
    }
    if (capability == "submissions" && state.kits.submissions)
    {
        out << "Étape : " << HumanLabel(state.kits.submissions->stage) << '\n';
        for (const auto& session : state.kits.submissions->sessions)
        {
            out << HumanLabel(session.kind) << " " << session.id
                << (session.revealed ? " — révélée" : session.closed ? " — fermée" : " — ouverte") << '\n';
            out << "Ont soumis : "; Players(out, state, session.submittedPlayerIds); out << '\n';
            out << "En attente : "; Players(out, state, session.pendingPlayerIds); out << '\n';
            for (const auto& [playerId, value] : session.visibleValues)
                out << Player(state, playerId) << " : " << ValueLines(value) << '\n';
            if (session.ownValue) out << "Votre soumission : " << ValueLines(*session.ownValue) << '\n';
        }
        for (const auto& judge : state.kits.submissions->judges)
            if (judge.playerId) out << "Juge : " << Player(state, *judge.playerId) << '\n';
        return out.str();
    }
    return std::nullopt;
}
}
