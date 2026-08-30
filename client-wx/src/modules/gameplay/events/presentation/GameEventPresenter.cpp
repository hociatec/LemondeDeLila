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
    if (found == data.end() || !found->is_number_integer()) return "un joueur";
    const int id = found->get<int>();
    const auto player = std::find_if(players.begin(), players.end(),
        [id](const domain::GamePlayer& value) { return value.id == id; });
    return player == players.end() ? "Joueur " + std::to_string(id) : player->username;
}

std::string Content(const nlohmann::json& data, const char* key)
{
    const auto found = data.find(key);
    if (found == data.end()) return {};
    if (found->is_string() || found->is_number()) return Text(data, key);
    if (!found->is_object()) return {};
    for (const auto* labelKey : {"label", "name", "title", "id", "cardId", "itemId"})
        if (const auto value = Text(*found, labelKey); !value.empty()) return value;
    return {};
}

std::string Label(const nlohmann::json& data, const char* key)
{
    const auto value = Text(data, key);
    return value.empty() ? std::string{} : application::info::HumanLabel(value);
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
    if (event.type == "card.drawn")
        return actor + " pioche une carte" + (Label(event.data, "deckId").empty()
            ? "." : " dans " + Label(event.data, "deckId") + ".");
    if (event.type == "card.received")
        return Player(event.data, "playerId", players) + " reçoit une carte.";
    if (event.type == "card.played")
    {
        const auto card = Content(event.data, "card");
        return actor + " joue " + (card.empty() ? "une carte" : card) + ".";
    }
    if (event.type == "card.discarded")
    {
        const auto card = Content(event.data, "card");
        return (card.empty() ? "Une carte" : card) + " est défaussée.";
    }
    if (event.type == "card.transferred")
        return Player(event.data, "fromPlayerId", players) + " donne une carte à " +
            Player(event.data, "toPlayerId", players) + ".";
    if (event.type == "cards.exchanged" || event.type == "cards.hands-swapped")
        return Player(event.data, "leftPlayerId", players) + " et " +
            Player(event.data, "rightPlayerId", players) + " échangent leurs cartes.";
    if (event.type == "score.changed")
        return Player(event.data, "playerId", players) + " a maintenant " +
            Text(event.data, "value") + " point(s).";
    if (event.type == "resource.changed")
        return Player(event.data, "playerId", players) + " : " +
            application::info::HumanLabel(Text(event.data, "resource")) + " vaut " +
            Text(event.data, "value") + ".";
    if (event.type == "resource.transferred")
        return Player(event.data, "from", players) + " transfère " +
            Text(event.data, "amount") + " " + Label(event.data, "resource") + " à " +
            Player(event.data, "to", players) + ".";
    if (event.type == "pawn.moved")
        return actor + " déplace son pion de la case " + Text(event.data, "from") +
            " à la case " + Text(event.data, "to") + ".";
    if (event.type == "pawn.landed")
        return Player(event.data, "playerId", players) + " arrive sur la case " +
            Text(event.data, "position") + ".";
    if (event.type == "pawn.assigned")
        return Label(event.data, "pawnId") + " est attribué à " +
            Player(event.data, "playerId", players) + ".";
    if (event.type == "turn.started")
        return "Tour de " + Player(event.data, "playerId", players) + ".";
    if (event.type == "turn.ended")
        return "Le tour de " + Player(event.data, "playerId", players) + " est terminé.";
    if (event.type == "player.eliminated")
        return Player(event.data, "playerId", players) + " est éliminé.";
    if (event.type == "player.skipped")
        return Player(event.data, "playerId", players) + " passe son tour.";
    if (event.type == "round.started")
        return "La manche " + Text(event.data, "number") + " commence.";
    if (event.type == "quiz.asked") return "Une nouvelle question est posée.";
    if (event.type == "quiz.revealed") return "La réponse du quiz est révélée.";
    if (event.type == "submissions.revealed" || event.type == "submission.revealed")
        return "Les soumissions sont révélées.";
    if (event.type == "submission.received")
        return Player(event.data, "playerId", players) + " a soumis sa réponse.";
    if (event.type == "judge.started" || event.type == "judge.changed")
        return Player(event.data, "playerId", players) + " devient juge.";
    if (event.type == "inventory.item-added")
        return Player(event.data, "playerId", players) + " reçoit " +
            Text(event.data, "count") + " " + Label(event.data, "itemId") + ".";
    if (event.type == "inventory.item-removed")
        return Player(event.data, "playerId", players) + " perd " +
            Text(event.data, "count") + " " + Label(event.data, "itemId") + ".";
    if (event.type == "economy.item-bought")
        return Player(event.data, "playerId", players) + " achète " +
            Label(event.data, "itemId") + ".";
    if (event.type == "economy.item-sold")
        return Player(event.data, "playerId", players) + " vend " +
            Label(event.data, "itemId") + ".";
    if (event.type == "round.ended") return "La manche est terminée.";
    if (event.type == "match.finished" || event.type == "game.finished")
        return "La partie est terminée.";
    return application::info::HumanLabel(event.type) + ".";
}
}
