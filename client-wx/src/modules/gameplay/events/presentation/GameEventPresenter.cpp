#include "modules/gameplay/events/presentation/GameEventPresenter.h"

#include <algorithm>

#include "modules/gameplay/information/application/GameValueTextBuilder.h"

namespace lila::modules::gameplay::presentation::events
{
namespace
{
std::string Text(const nlohmann::json& data, const char* key)
{
    const auto found = data.find(key);
    if (found == data.end()) return {};
    if (found->is_string()) return found->get<std::string>();
    if (found->is_number_integer()) return std::to_string(found->get<long long>());
    return {};
}

std::string Player(const nlohmann::json& data, const char* key,
    const std::vector<domain::GamePlayer>& players)
{
    const auto found = data.find(key);
    if (found == data.end() || !found->is_number_integer()) return {};
    const int id = found->get<int>();
    const auto player = std::find_if(players.begin(), players.end(),
        [id](const domain::GamePlayer& value) { return value.id == id; });
    return player == players.end() ? "Joueur " + std::to_string(id) : player->username;
}
}

std::string GameEventPresenter::Present(
    const domain::GameEngineEvent& event,
    const std::vector<domain::GamePlayer>& players)
{
    if (const auto message = Text(event.data, "message"); !message.empty()) return message;
    const auto actor = event.actorId ? [&]()
    {
        for (const auto& player : players) if (player.id == *event.actorId) return player.username;
        return std::string("Joueur ") + std::to_string(*event.actorId);
    }() : std::string("Un joueur");
    if (event.type == "dice.rolled")
        return actor + " lance les dés" + (Text(event.data, "total").empty()
            ? "." : " : " + Text(event.data, "total") + ".");
    if (event.type == "card.drawn") return actor + " pioche une carte.";
    if (event.type == "card.played") return actor + " joue une carte.";
    if (event.type == "score.changed")
        return Player(event.data, "playerId", players) + " a maintenant " +
            Text(event.data, "value") + " point(s).";
    if (event.type == "resource.changed")
        return Player(event.data, "playerId", players) + " : " +
            application::info::HumanLabel(Text(event.data, "resource")) + " vaut " +
            Text(event.data, "value") + ".";
    if (event.type == "pawn.moved")
        return actor + " déplace son pion de la case " + Text(event.data, "from") +
            " à la case " + Text(event.data, "to") + ".";
    if (event.type == "quiz.asked") return "Une nouvelle question est posée.";
    if (event.type == "quiz.revealed") return "La réponse du quiz est révélée.";
    if (event.type == "submission.revealed") return "Les soumissions sont révélées.";
    if (event.type == "round.ended") return "La manche est terminée.";
    if (event.type == "match.finished" || event.type == "game.finished")
        return "La partie est terminée.";
    return application::info::HumanLabel(event.type) + ".";
}
}
