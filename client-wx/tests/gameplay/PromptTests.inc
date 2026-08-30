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

    const auto state = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(V2Payload(payload));
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
    lila::modules::gameplay::domain::GamePromptField number;
    number.key = "score";
    number.label = "Score";
    number.kind = "number";
    number.minimum = 1;
    number.maximum = 40;
    Expect(GamePromptInputCodec::Parse(number, "12").value == 12, "Un entier valide doit être converti.");
    Expect(!GamePromptInputCodec::Parse(number, "41").valid, "La borne maximale doit être appliquée.");
    Expect(GamePromptInputCodec::Parse(number, "12.5").value == 12.5,
        "Un schema numérique non entier doit accepter les décimales.");
    number.integer = true;
    Expect(!GamePromptInputCodec::Parse(number, "12.5").valid,
        "La contrainte integer du catalogue doit être appliquée.");

    lila::modules::gameplay::domain::GamePromptField boolean;
    boolean.key = "enabled";
    boolean.label = "Active";
    boolean.kind = "boolean";
    Expect(GamePromptInputCodec::Parse(boolean, "oui").value == true, "Oui doit produire true.");
    Expect(GamePromptInputCodec::Parse(boolean, "non").value == false, "Non doit produire false.");
    Expect(!GamePromptInputCodec::Parse(boolean, "peut-être").valid, "Une valeur booléenne ambiguë doit être refusée.");
}

void TestActionCatalogBuildsTypedControls()
{
    using lila::modules::gameplay::application::GameActionPromptFactory;
    lila::modules::gameplay::domain::GameAction action;
    action.type = "answer";
    const auto catalog = nlohmann::json::array({{
        {"type", "answer"},
        {"input", {{"type", "object"}, {"properties", {
            {"choice", {{"type", "enum"}, {"values", {"alpha", "beta"}}}},
            {"count", {{"type", "number"}, {"integer", true}, {"min", 1}}},
            {"tags", {{"type", "array"}, {"items", {{"type", "string"}}}}},
        }}}},
        {"ui", {{"label", "Répondre"}, {"control", "form"}}},
    }});
    const auto prompt = GameActionPromptFactory::Build(action,
        lila::modules::gameplay::infrastructure::GameActionCatalogDecoder::Decode(catalog));
    Expect(prompt.has_value() && prompt->fields.size() == 3,
        "Le catalogue doit produire tous les contrôles requis.");
    const auto choice = std::find_if(prompt->fields.begin(), prompt->fields.end(),
        [](const auto& field) { return field.key == "choice"; });
    const auto count = std::find_if(prompt->fields.begin(), prompt->fields.end(),
        [](const auto& field) { return field.key == "count"; });
    const auto tags = std::find_if(prompt->fields.begin(), prompt->fields.end(),
        [](const auto& field) { return field.key == "tags"; });
    Expect(choice != prompt->fields.end() && choice->choices.size() == 2,
        "Une enum doit devenir une liste de choix typée.");
    Expect(count != prompt->fields.end() && count->integer && count->minimum == 1,
        "Les contraintes numériques doivent être conservées.");
    Expect(tags != prompt->fields.end() && tags->kind == "array",
        "Un tableau doit rester un tableau générique éditable.");
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

    const auto state = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(V2Payload(payload));
    Expect(state.prompt.has_value(),
        "Le client V2 doit conserver le formulaire projeté sans réinterpréter la phase.");
    Expect(state.pending.has_value(),
        "Le pending V2 doit rester la source de vérité du serveur.");
    Expect(state.kits.VisibleHand().size() == 1,
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
                    {"fields", nlohmann::json::array({
                        {{"key", "score"}, {"label", "Score"}, {"kind", "number"}},
                    })},
                }},
            }},
        }},
    };

    const auto state = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(V2Payload(payload));
    Expect(state.prompt.has_value(),
        "Le formulaire projeté doit rester descriptible même sans action disponible.");
    Expect(state.pending.has_value(),
        "Le pending serveur ne doit pas être supprimé par une heuristique cliente.");
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
    const auto state = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(V2Payload(payload));
    Expect(state.lines.size() == 2, "Les deux actions doivent être affichées.");
    Expect(state.lines[0].label != state.lines[1].label, "Le payload doit distinguer des libellés identiques.");
}
