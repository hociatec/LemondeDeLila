#include "modules/gameplay/events/presentation/GameEventPresenter.h"

#include <algorithm>

#include "modules/gameplay/information/application/GameValueTextBuilder.h"

namespace lila::modules::gameplay::presentation::events
{
namespace
{
std::string Player(const std::optional<int>& playerId,
    const std::vector<domain::GamePlayer>& players)
{
    if (!playerId) return "un joueur";
    const int id = *playerId;
    const auto player = std::find_if(players.begin(), players.end(),
        [id](const domain::GamePlayer& value) { return value.id == id; });
    return player == players.end() ? "Joueur " + std::to_string(id) : player->username;
}

std::string Label(const std::string& value)
{
    return value.empty() ? std::string{} : application::info::HumanLabel(value);
}
}

std::string GameEventPresenter::Present(
    const domain::GameEngineEvent& event,
    const std::vector<domain::GamePlayer>& players)
{
    const auto& data = event.details;
    if (!data.message.empty()) return data.message;
    const auto actor = event.actorId ? [&]()
    {
        for (const auto& player : players) if (player.id == *event.actorId) return player.username;
        return std::string("Joueur ") + std::to_string(*event.actorId);
    }() : std::string("Un joueur");
    if (event.type == "dice.rolled")
        return actor + " lance les dés" + (data.total.empty()
            ? "." : " : " + data.total + ".");
    if (event.type == "card.drawn")
        return actor + " pioche une carte" + (Label(data.deckId).empty()
            ? "." : " dans " + Label(data.deckId) + ".");
    if (event.type == "card.received")
        return Player(data.playerId, players) + " reçoit une carte.";
    if (event.type == "card.played")
    {
        return actor + " joue " + (data.content.empty() ? "une carte" : data.content) + ".";
    }
    if (event.type == "card.discarded")
    {
        return (data.content.empty() ? "Une carte" : data.content) + " est défaussée.";
    }
    if (event.type == "card.transferred")
        return Player(data.sourcePlayerId, players) + " donne une carte à " +
            Player(data.targetPlayerId, players) + ".";
    if (event.type == "cards.exchanged" || event.type == "cards.hands-swapped")
        return Player(data.leftPlayerId, players) + " et " +
            Player(data.rightPlayerId, players) + " échangent leurs cartes.";
    if (event.type == "score.changed")
        return Player(data.playerId, players) + " a maintenant " + data.value + " point(s).";
    if (event.type == "resource.changed")
        return Player(data.playerId, players) + " : " + Label(data.resourceId) + " vaut " +
            data.value + ".";
    if (event.type == "resource.transferred")
        return Player(data.sourcePlayerId, players) + " transfère " +
            data.amount + " " + Label(data.resourceId) + " à " +
            Player(data.targetPlayerId, players) + ".";
    if (event.type == "pawn.moved")
        return actor + " déplace son pion de la case " + data.fromPosition +
            " à la case " + data.toPosition + ".";
    if (event.type == "pawn.landed")
        return Player(data.playerId, players) + " arrive sur la case " + data.position + ".";
    if (event.type == "pawn.assigned")
        return Label(data.pawnId) + " est attribué à " + Player(data.playerId, players) + ".";
    if (event.type == "turn.started")
        return "Tour de " + Player(data.playerId, players) + ".";
    if (event.type == "turn.ended")
        return "Le tour de " + Player(data.playerId, players) + " est terminé.";
    if (event.type == "player.eliminated")
        return Player(data.playerId, players) + " est éliminé.";
    if (event.type == "player.skipped")
        return Player(data.playerId, players) + " passe son tour.";
    if (event.type == "round.started")
        return "La manche " + data.number + " commence.";
    if (event.type == "quiz.asked") return "Une nouvelle question est posée.";
    if (event.type == "quiz.revealed") return "La réponse du quiz est révélée.";
    if (event.type == "submissions.revealed" || event.type == "submission.revealed")
        return "Les soumissions sont révélées.";
    if (event.type == "submission.received")
        return Player(data.playerId, players) + " a soumis sa réponse.";
    if (event.type == "judge.started" || event.type == "judge.changed")
        return Player(data.playerId, players) + " devient juge.";
    if (event.type == "inventory.item-added")
        return Player(data.playerId, players) + " reçoit " + data.count + " " +
            Label(data.itemId) + ".";
    if (event.type == "inventory.item-removed")
        return Player(data.playerId, players) + " perd " + data.count + " " +
            Label(data.itemId) + ".";
    if (event.type == "economy.item-bought")
        return Player(data.playerId, players) + " achète " + Label(data.itemId) + ".";
    if (event.type == "economy.item-sold")
        return Player(data.playerId, players) + " vend " + Label(data.itemId) + ".";
    if (event.type == "round.ended") return "La manche est terminée.";
    if (event.type == "match.finished" || event.type == "game.finished")
        return "La partie est terminée.";
    const auto type = Label(event.type);
    return type.empty() ? std::string("Événement de jeu.") : type + ".";
}
}
