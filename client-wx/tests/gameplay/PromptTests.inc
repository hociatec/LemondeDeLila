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
                    {"submitThenStart", true},
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
    Expect(state.prompt->submitThenStart,
        "Le serveur doit pouvoir demander le démarrage après validation.");
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

    lila::modules::gameplay::domain::GamePromptField boolean{
        "enabled", "Active", "boolean", "", std::nullopt, std::nullopt};
    Expect(GamePromptInputCodec::Parse(boolean, "oui").value == true, "Oui doit produire true.");
    Expect(GamePromptInputCodec::Parse(boolean, "non").value == false, "Non doit produire false.");
    Expect(!GamePromptInputCodec::Parse(boolean, "peut-être").valid, "Une valeur booléenne ambiguë doit être refusée.");
}

void TestStaleSetupPromptIsIgnoredDuringRound()
{
    const auto payload = nlohmann::json{
        {"roomId", 15},
        {"gameType", "server-driven-game"},
        {"state", {
            {"status", "started"},
            {"phase", "round"},
            {"pending", {
                {"type", "config_prompt"},
                {"data", {
                    {"actionType", "configure_round"},
                    {"fields", nlohmann::json::array({
                        {{"key", "score"}, {"label", "Score"}, {"kind", "number"}},
                    })},
                }},
            }},
            {"extras", {{"hand", nlohmann::json::array({
                {{"id", "1"}, {"label", "1"}},
            })}}},
        }},
    };

    const auto state = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(payload);
    Expect(!state.prompt.has_value(),
        "Un formulaire de configuration perime ne doit pas remplacer les commandes de la manche.");
    Expect(!state.pending.has_value(),
        "Le pending de configuration perime ne doit pas rester affiche pendant la manche.");
    Expect(state.hand.size() == 1,
        "La main de la manche doit rester disponible apres filtrage du formulaire perime.");
}

void TestPromptWithoutItsServerActionCannotReopen()
{
    const auto payload = nlohmann::json{
        {"roomId", 16},
        {"gameType", "server-driven-game"},
        {"state", {
            {"status", "started"},
            {"phase", "setup"},
            {"actions", nlohmann::json::array({
                {{"type", "play"}, {"payload", {{"card", 2}}}},
            })},
            {"pending", {
                {"type", "config_prompt"},
                {"data", {
                    {"actionType", "configure"},
                    {"submitThenStart", true},
                    {"fields", nlohmann::json::array({
                        {{"key", "score"}, {"label", "Score"}, {"kind", "number"}},
                    })},
                }},
            }},
        }},
    };

    const auto state = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(payload);
    Expect(!state.prompt.has_value(),
        "Un formulaire sans son action serveur ne doit jamais redevenir interactif.");
    Expect(!state.pending.has_value(),
        "Un ancien pending de configuration ne doit pas masquer les nouvelles actions.");
    Expect(state.actions.size() == 1 && state.actions.front().type == "play",
        "Les actions courantes doivent rester disponibles apres le filtrage.");
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
