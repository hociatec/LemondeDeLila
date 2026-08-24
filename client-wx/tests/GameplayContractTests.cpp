#include <iostream>
#include <stdexcept>
#include <string>

#include <nlohmann/json.hpp>

#include "modules/gameplay/application/GamePromptInputCodec.h"
#include "modules/gameplay/infrastructure/GameStatePayloadCodec.h"

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
}

int main()
{
    try
    {
        TestServerDrivenPrompt();
        TestTypedInputs();
        TestActionLabelsRemainDistinct();
        std::cout << "Gameplay contract tests passed.\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
