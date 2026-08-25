#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "modules/gameplay/cards/application/GameCardActionResolver.h"
#include "modules/gameplay/cards/application/GameCardTextBuilder.h"
#include "modules/gameplay/prompts/application/GamePromptInputCodec.h"
#include "modules/gameplay/state/infrastructure/GameStatePayloadCodec.h"
#include "modules/gameplay/history/presentation/GameLogCursor.h"

namespace
{
void Expect(bool condition, const char* message)
{
    if (!condition) throw std::runtime_error(message);
}

void TestServerDrivenPrompt()
{
    const auto payload = nlohmann::json{
        {"roomId", 7},
        {"gameType", "example-game"},
        {"state", {
            {"actions", nlohmann::json::array({
                {{"type", "configure"}, {"label", "Configurer"}, {"payload", nlohmann::json::object()}},
            })},
            {"pending", {
                {"type", "config_prompt"},
                {"label", "Réglages de la partie"},
                {"data", {
                    {"title", "Configuration"},
                    {"actionType", "configure"},
                    {"cancelActionType", "cancel_config"},
                    {"fields", nlohmann::json::array({
                        {{"key", "target"}, {"label", "Score cible"}, {"kind", "number"}, {"initialText", "40"}, {"min", 1}, {"max", 100}},
                        {{"key", "enabled"}, {"label", "Option active"}, {"kind", "boolean"}, {"initialText", "oui"}},
                    })},
                }},
            }},
            {"extras", {{"shortcuts", nlohmann::json::array({
                {{"key", "Q"}, {"type", "action"}, {"actionType", "configure"}},
            })}}},
        }},
    };

    const auto state = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(payload);
    Expect(state.prompt.has_value(), "Le formulaire serveur doit être décodé.");
    Expect(state.prompt->actionType == "configure", "Le formulaire doit cibler son action.");
    Expect(state.prompt->cancelActionType == "cancel_config", "L'action d'annulation doit être conservée.");
    Expect(state.prompt->fields.size() == 2, "Tous les champs génériques doivent être conservés.");
    Expect(state.prompt->fields[0].minimum == 1 && state.prompt->fields[0].maximum == 100,
        "Les bornes numériques doivent être conservées.");
    Expect(state.shortcuts.size() == 1 && state.shortcuts[0].normalizedKey == "Q",
        "Les raccourcis restent pilotés par le serveur.");
}

void TestTypedInputs()
{
    using lila::modules::gameplay::application::GamePromptInputCodec;
    lila::modules::gameplay::domain::GamePromptField number{"score", "Score", "number", "", 1, 40};
    Expect(GamePromptInputCodec::Parse(number, "12").value == 12, "Un entier valide doit être converti.");
    Expect(!GamePromptInputCodec::Parse(number, "41").valid, "La borne maximale doit être appliquée.");

    lila::modules::gameplay::domain::GamePromptField boolean{"enabled", "Active", "boolean"};
    Expect(GamePromptInputCodec::Parse(boolean, "oui").value == true, "Oui doit produire true.");
    Expect(GamePromptInputCodec::Parse(boolean, "non").value == false, "Non doit produire false.");
    Expect(!GamePromptInputCodec::Parse(boolean, "peut-être").valid, "Une valeur booléenne ambiguë doit être refusée.");
}

void TestActionLabelsRemainDistinct()
{
    const auto payload = nlohmann::json{
        {"roomId", 8},
        {"gameType", "example-game"},
        {"actions", nlohmann::json::array({
            {{"type", "play"}, {"label", "Jouer"}, {"payload", {{"card", "3"}}}},
            {{"type", "play"}, {"label", "Jouer"}, {"payload", {{"card", "7"}}}},
        })},
    };
    const auto state = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(payload);
    Expect(state.lines.size() == 2, "Les deux actions doivent être affichées.");
    Expect(state.lines[0].label != state.lines[1].label, "Le payload doit distinguer des libellés identiques.");
}

void TestGenericCardsContract()
{
    const auto payload = nlohmann::json{
        {"roomId", 11},
        {"gameType", "card-game"},
        {"state", {{"extras", {
            {"hand", nlohmann::json::array({
                {{"id", "wolf"}, {"label", "Le loup"}},
                {{"id", "moon"}, {"label", "La lune"}, {"description", "Carte nocturne"}},
                {{"id", "unknown"}, {"label", "unknown"}},
            })},
        }}}},
    };

    const auto state = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(payload);
    Expect(state.hand.size() == 3, "Toutes les cartes de la main doivent etre conservees.");
    Expect(state.hand[0].id == "wolf" && state.hand[0].label == "Le loup",
        "Une carte doit recevoir le libelle riche correspondant a son identifiant.");
    Expect(state.hand[1].description == "Carte nocturne",
        "La description generique d'une carte doit etre conservee.");
    Expect(lila::modules::gameplay::application::cards::GameCardTextBuilder::AccessibleText(state.hand[1]) ==
            "La lune. Carte nocturne",
        "La description d'une carte doit etre disponible au lecteur d'ecran.");
    Expect(state.hand[2].label == "unknown",
        "Une carte inconnue doit rester utilisable avec son identifiant comme libelle.");
}

void TestCardsCarryTheirActionsAcrossGames()
{
    using lila::modules::gameplay::application::cards::GameCardActionResolver;
    const auto payload = nlohmann::json{
        {"roomId", 12},
        {"gameType", "generic-card-game"},
        {"state", {
            {"actions", nlohmann::json::array({
                {{"type", "inspect"}, {"payload", nlohmann::json::object()}},
                {{"type", "play"}, {"payload", {{"cardId", "wolf"}}}},
                {{"type", "play"}, {"payload", {{"cardId", "wolf"}}}},
            })},
            {"extras", {{"hand", nlohmann::json::array({
                {{"id", "wolf"}, {"label", "Le loup"}, {"actionIndex", 1}},
                {{"id", "wolf"}, {"label", "Le second loup"}, {"actionIndex", 2}},
                {{"id", "moon"}, {"label", "La lune"}, {"disabled", true}},
            })}}},
        }},
    };
    const auto state = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(payload);
    const auto first = GameCardActionResolver::Resolve(state.hand, state.actions, 0);
    const auto second = GameCardActionResolver::Resolve(state.hand, state.actions, 1);
    Expect(first.has_value() && first->payload.at("cardId") == "wolf",
        "Une carte doit executer l'action explicitement associee par le serveur.");
    Expect(second.has_value() && second->type == "play",
        "Deux exemplaires d'une carte doivent conserver deux actions distinctes.");
    Expect(!GameCardActionResolver::Resolve(state.hand, state.actions, 2).has_value(),
        "Une carte desactivee doit rester consultable sans etre jouable.");
}

void TestServerDrivenPawnSelection()
{
    const auto payload = nlohmann::json{
        {"roomId", 9},
        {"gameType", "morpion"},
        {"state", {
            {"actions", nlohmann::json::array({
                {{"type", "choose_pawn"}, {"payload", {{"pawnId", "flower"}}}},
                {{"type", "choose_pawn"}, {"payload", {{"pawnId", "stone"}}}},
            })},
            {"pending", {
                {"type", "choose_pawn"},
                {"playerId", 7},
                {"choices", nlohmann::json::array({"Une fleur", "Un caillou"})},
                {"data", {
                    {"pawns", nlohmann::json::array({
                        {{"id", "flower"}, {"label", "Une fleur"}},
                        {{"id", "stone"}, {"label", "Un caillou"}},
                    })},
                    {"choiceActionsByIndex", nlohmann::json::array({
                        {{"type", "choose_pawn"}, {"payload", {{"pawnId", "flower"}}}},
                        {{"type", "choose_pawn"}, {"payload", {{"pawnId", "stone"}}}},
                    })},
                }},
            }},
        }},
    };

    const auto state = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(payload);
    Expect(state.pawnSelection.has_value(), "Le choix de pion actif doit etre decode.");
    Expect(state.pawnSelection->label == "Votre pion.", "Le libelle WPF du choix de pion est attendu.");
    Expect(state.pawnSelection->choices.size() == 2, "Tous les pions serveur doivent etre proposes.");
    Expect(state.pawnSelection->choices[1].label == "Un caillou", "Le libelle serveur doit rester intact.");
    Expect(state.pawnSelection->choices[1].action.payload.at("pawnId") == "stone",
        "Le choix doit renvoyer l'action explicitement associee par le serveur.");
}

void TestPawnSelectionHiddenForPassiveViewer()
{
    const auto payload = nlohmann::json{
        {"roomId", 10},
        {"gameType", "morpion"},
        {"state", {
            {"actions", nlohmann::json::array()},
            {"pending", {
                {"type", "choose_pawn"},
                {"playerId", 8},
                {"choices", nlohmann::json::array({"Une fleur"})},
                {"data", {{"pawns", nlohmann::json::array({
                    {{"id", "flower"}, {"label", "Une fleur"}},
                })}}},
            }},
        }},
    };

    const auto state = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(payload);
    Expect(!state.pawnSelection.has_value(),
        "Un spectateur ou joueur passif ne doit pas recevoir une liste interactive.");
}

void TestGameLogCursor()
{
    using lila::modules::gameplay::presentation::history::GameLogCursor;
    GameLogCursor cursor;
    Expect(cursor.ExtractNew({"A", "B"}) == std::vector<std::string>({"A", "B"}),
        "Le premier journal doit etre publie une seule fois.");
    Expect(cursor.ExtractNew({"A", "B"}).empty(),
        "Un etat identique ne doit rien republier.");
    Expect(cursor.ExtractNew({}).empty(),
        "Un journal transitoirement absent ne doit pas reinitialiser le curseur.");
    Expect(cursor.ExtractNew({"A", "B", "C"}) == std::vector<std::string>({"C"}),
        "Seule la nouvelle entree doit etre publiee.");
    Expect(cursor.ExtractNew({"B", "C", "D"}) == std::vector<std::string>({"D"}),
        "Le curseur doit supporter un journal tronque cote serveur.");
    cursor.Reset();
    Expect(cursor.ExtractNew({"D"}) == std::vector<std::string>({"D"}),
        "La reinitialisation doit ouvrir une nouvelle session.");
}
}

int main()
{
    try
    {
        TestServerDrivenPrompt();
        TestTypedInputs();
        TestActionLabelsRemainDistinct();
        TestGenericCardsContract();
        TestCardsCarryTheirActionsAcrossGames();
        TestServerDrivenPawnSelection();
        TestPawnSelectionHiddenForPassiveViewer();
        TestGameLogCursor();
        std::cout << "Gameplay contract tests passed.\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
