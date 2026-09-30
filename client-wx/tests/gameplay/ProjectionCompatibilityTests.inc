void TestProjectionCompatibilityAndLimits()
{
    const auto errorFor = [](nlohmann::json payload)
    {
        try
        {
            static_cast<void>(lila::modules::gameplay::infrastructure::
                GameStatePayloadCodec::DecodeState(payload));
        }
        catch (const std::exception& error) { return std::string(error.what()); }
        return std::string{};
    };
    auto payload = BuildGameView({{"roomId", 90}, {"gameType", "unknown-client-game"}});
    payload["system"]["setup"]["phase"] = "custom-phase";
    const auto typedPhase = lila::modules::gameplay::infrastructure::
        GameStatePayloadCodec::DecodeState(payload);
    Expect(typedPhase.system.setup.phase.value == "custom-phase",
        "La phase extensible doit être décodée dans son type dédié.");
    auto future = payload;
    future["viewVersion"] = 2;
    Expect(errorFor(future).find("non supportee") != std::string::npos,
        "Une viewVersion future doit être refusée proprement.");
    auto absent = payload;
    absent.erase("viewVersion");
    auto nullVersion = payload;
    nullVersion["viewVersion"] = nullptr;
    auto wrongVersion = payload;
    wrongVersion["viewVersion"] = "1";
    Expect(errorFor(absent).find("absent") != std::string::npos &&
            errorFor(nullVersion).find("null") != std::string::npos &&
            errorFor(wrongVersion).find("entier attendu") != std::string::npos,
        "Absent, null et mauvais type doivent produire des diagnostics distincts.");
    auto deep = payload;
    nlohmann::json nested = 1;
    for (int depth = 0; depth < 40; ++depth) nested = {{"next", std::move(nested)}};
    deep["game"] = std::move(nested);
    Expect(errorFor(deep).find("trop profonde") != std::string::npos,
        "Une projection gameplay trop profonde doit être bornée.");
    auto numerous = payload;
    numerous["actions"] = nlohmann::json::array();
    for (int index = 0; index < 129; ++index)
        numerous["actions"].push_back({{"type", "opaque"}});
    Expect(errorFor(numerous).find("Trop d'actions") != std::string::npos,
        "Le nombre d'actions projetées doit être borné.");
    auto invalidGrid = payload;
    invalidGrid["kits"] = {{"grid", {{"boards", {{"board", {
        {"width", -1}, {"height", 3}}}}}}}};
    Expect(errorFor(invalidGrid).find("Dimensions") != std::string::npos,
        "Les dimensions de grille invalides doivent être refusées.");
    auto tooManyBoards = payload;
    tooManyBoards["kits"]["grid"]["boards"] = nlohmann::json::object();
    for (int index = 0; index < 33; ++index)
        tooManyBoards["kits"]["grid"]["boards"][std::to_string(index)] = {
            {"width", 1}, {"height", 1}};
    Expect(errorFor(tooManyBoards).find("Trop de plateaux") != std::string::npos,
        "Le nombre de plateaux doit être borné.");
    auto tooManyCards = payload;
    tooManyCards["kits"]["cards"]["zones"]["public"]["cards"] =
        nlohmann::json::array();
    for (int index = 0; index < 1'025; ++index)
        tooManyCards["kits"]["cards"]["zones"]["public"]["cards"].push_back(index);
    Expect(errorFor(tooManyCards).find("Trop de cartes") != std::string::npos,
        "Le nombre de cartes d'une collection doit être borné avant allocation.");
    auto oversizedPhase = payload;
    oversizedPhase["system"]["setup"]["phase"] = std::string(129, 'p');
    Expect(errorFor(oversizedPhase).find("phase trop volumineux") != std::string::npos,
        "L'identifiant de phase doit être borné au décodage.");
}

void TestUnknownGameUsesOnlyPublicCapabilities()
{
    auto payload = BuildGameView({{"roomId", 91},
        {"gameType", "synthetic-unregistered-game"}, {"viewerPlayerId", 7}});
    payload["actions"] = nlohmann::json::array({
        {{"type", "synthetic.submit"}, {"label", "Envoyer"},
            {"payload", nlohmann::json::object()}},
        {{"type", "synthetic.choice"}, {"label", "Choisir"},
            {"payload", {{"choice", "alpha"}}}}});
    payload["actionCatalog"] = nlohmann::json::array({
        {{"type", "synthetic.submit"}, {"ui", {{"label", "Envoyer"}}},
            {"input", {{"type", "object"}, {"properties", {
                {"message", {{"type", "string"}, {"label", "Message"}}}}}}}}});
    payload["pending"] = {
        {"type", "synthetic"}, {"label", "Choisissez"},
        {"choices", nlohmann::json::array({"Alpha"})},
        {"data", {{"choiceActionsByIndex", nlohmann::json::array({payload["actions"][1]})}}}};
    payload["system"]["shortcuts"] = nlohmann::json::array({
        {{"key", "K"}, {"type", "action"}, {"actionType", "synthetic.submit"},
            {"label", "Envoyer"}}});
    payload["system"]["events"]["recent"] = nlohmann::json::array({
        {{"id", "1:0"}, {"type", "synthetic.happened"},
            {"soundSemantic", "card.drawn"}, {"occurredAtMs", 1},
            {"data", {{"message", "Événement synthétique."}}}}});
    payload["timers"] = {{"synthetic", {{"label", "Temps restant"},
        {"remainingMs", 2'000}, {"paused", false}}}};
    const auto state = lila::modules::gameplay::infrastructure::
        GameStatePayloadCodec::DecodeState(payload);
    auto replacementPayload = payload;
    replacementPayload["gameType"] = "synthetic-replacement-game";
    const auto replacement = lila::modules::gameplay::infrastructure::
        GameStatePayloadCodec::DecodeState(replacementPayload);
    const auto prompt = lila::modules::gameplay::application::
        GameActionPromptFactory::Build(state.actions[0], state.actionCatalog);
    Expect(state.gameType == "synthetic-unregistered-game" &&
            state.pending && state.pending->viewerActionable &&
            state.pending->choices[0].action && state.system.shortcuts.size() == 1 &&
            state.timers.size() == 1 && prompt && prompt->fields.size() == 1 &&
            state.system.events.size() == 1 &&
            replacement.gameType == "synthetic-replacement-game" &&
            replacement.actions.size() == state.actions.size() &&
            replacement.pending && replacement.pending->viewerActionable &&
            lila::modules::gameplay::application::GameSoundEventType(
                state.system.events[0]) == "card.drawn",
        "Un jeu inconnu doit être piloté uniquement par ses capabilities publiques.");
}

void TestUnknownWorkflowHasAccessibleFallback()
{
    auto payload = BuildGameView({{"roomId", 92},
        {"gameType", "synthetic-unregistered-game"}});
    payload["pending"] = {
        {"type", "future-workflow"},
        {"data", {{"kind", "select_mysterious_relic"}, {"opaque", 42}}}};
    const auto state = lila::modules::gameplay::infrastructure::
        GameStatePayloadCodec::DecodeState(payload);
    Expect(state.pending.has_value(),
        "Un workflow inconnu doit rester visible dans la projection.");
    const auto fallback = lila::modules::gameplay::application::
        GamePendingAccessibilityText::Build(*state.pending);
    Expect(fallback == "Interaction de jeu en attente : Select mysterious relic.",
        "Un workflow inconnu sans texte serveur doit fournir un fallback accessible stable.");

    auto labelledPending = *state.pending;
    labelledPending.label = "Choisissez une relique";
    Expect(lila::modules::gameplay::application::GamePendingAccessibilityText::Build(
            labelledPending) == "Choisissez une relique",
        "Le texte explicite du serveur doit rester prioritaire sur le fallback.");
}

void TestNumericNetworkKeysAreStrictlyValidated()
{
    using lila::shared::data::ParseInteger;
    Expect(ParseInteger("-2") == -2 && ParseInteger("17") == 17 &&
            !ParseInteger("") && !ParseInteger(" 7") && !ParseInteger("7x") &&
            !ParseInteger("999999999999999999999999"),
        "La conversion d'identifiant doit être exacte, bornée et non levante.");

    auto payload = BuildGameView({{"roomId", 93}, {"gameType", "numeric-keys"}});
    payload["system"]["turn"]["skipTurnsByPlayer"] = {
        {"7", 2}, {"invalid", 9}, {"999999999999999999999999", 4}};
    payload["system"]["match"]["playerStatuses"] = {
        {"-2", "ready"}, {"invalid", "ghost"}};
    payload["kits"]["score"]["byPlayer"] = {
        {"7", 12}, {"invalid", 99}};
    payload["kits"]["inventory"] = {{"items", {
        {"visibility", "public"}, {"byPlayer", {
            {"7", nlohmann::json::array({"apple"})},
            {"invalid", nlohmann::json::array({"ghost"})}}}}}};
    payload["kits"]["cards"] = {{"hands", {{"main", {
        {"visibility", "owner"}, {"byPlayer", {
            {"7", nlohmann::json::array({"card-a"})},
            {"invalid", nlohmann::json::array({"ghost"})}}}}}}}};
    payload["kits"]["submissions"] = {{"sessions", {{"s1", {
        {"valuesByPlayerId", {{"7", "ok"}, {"invalid", "ghost"}}}}}}}};

    const auto state = lila::modules::gameplay::infrastructure::
        GameStatePayloadCodec::DecodeState(payload);
    Expect(state.system.turn.skipTurnsByPlayer.size() == 1 &&
            state.system.turn.skipTurnsByPlayer.contains(7) &&
            state.system.match.playerStatuses.size() == 1 &&
            state.system.match.playerStatuses.contains(-2) &&
            state.kits.score && state.kits.score->byPlayer.size() == 1 &&
            state.kits.score->byPlayer.contains(7) &&
            state.kits.inventory && state.kits.inventory->sets[0].players.size() == 1 &&
            state.kits.inventory->sets[0].players[0].playerId == 7 &&
            state.kits.cards && state.kits.cards->hands[0].players.size() == 1 &&
            state.kits.cards->hands[0].players[0].playerId == 7 &&
            state.kits.submissions &&
            state.kits.submissions->sessions[0].visibleValues.size() == 1 &&
            state.kits.submissions->sessions[0].visibleValues.contains(7),
        "Les clés numériques réseau invalides doivent être ignorées sans créer le joueur 0.");
}

void TestInvalidChoiceIndexesAndPlayerIdsAreRejected()
{
    auto invalidViewer = BuildGameView({{"roomId", 94},
        {"gameType", "invalid-identities"}, {"viewerPlayerId", 0}});
    bool viewerRejected = false;
    try
    {
        static_cast<void>(lila::modules::gameplay::infrastructure::
            GameStatePayloadCodec::DecodeState(invalidViewer));
    }
    catch (const std::exception& error)
    {
        viewerRejected = std::string(error.what()).find("viewer") != std::string::npos;
    }
    Expect(viewerRejected, "Le playerId 0 du viewer doit être rejeté.");

    auto payload = BuildGameView({{"roomId", 95}, {"gameType", "invalid-references"}});
    payload["system"]["players"]["all"] = nlohmann::json::array({
        {{"id", 0}, {"username", "Invalide"}},
        {{"id", -2}, {"username", "Bot"}, {"isBot", true}}});
    payload["system"]["turn"]["currentPlayerId"] = 0;
    payload["pending"] = {
        {"type", "future-choice"}, {"playerId", 0},
        {"choices", nlohmann::json::array({"A", "B"})},
        {"data", {{"kind", "single"}, {"choiceActionsByIndex",
            nlohmann::json::array({nullptr, nullptr,
                {{"type", "out.of.range"}, {"payload", nlohmann::json::object()}}})}}}};
    const auto state = lila::modules::gameplay::infrastructure::
        GameStatePayloadCodec::DecodeState(payload);
    Expect(state.system.players.size() == 1 && state.system.players[0].id == -2 &&
            !state.system.turn.currentPlayerId && state.pending &&
            !state.pending->playerId && !state.pending->viewerActionable &&
            !state.pending->choices[0].action && !state.pending->choices[1].action,
        "Les playerId nuls et mappings de choix hors plage doivent rester inactifs.");
}

void TestDisplayedTimersIgnoreSystemClockChanges()
{
    auto payload = BuildGameView({{"roomId", 96}, {"gameType", "timer-game"}});
    payload["timers"] = {{"turn", {{"label", "Tour"},
        {"remainingMs", 5'000}, {"deadlineMs", 1}, {"paused", false}}}};
    const auto beforeClockChange = lila::modules::gameplay::infrastructure::
        GameStatePayloadCodec::DecodeState(payload);
    payload["timers"]["turn"]["deadlineMs"] = 4'102'444'800'000LL;
    const auto afterClockChange = lila::modules::gameplay::infrastructure::
        GameStatePayloadCodec::DecodeState(payload);
    const auto beforeText = lila::modules::gameplay::application::info::
        GameCapabilityTextBuilder::Build(beforeClockChange, "timers");
    const auto afterText = lila::modules::gameplay::application::info::
        GameCapabilityTextBuilder::Build(afterClockChange, "timers");
    Expect(beforeText == afterText && beforeText.find("5 seconde") != std::string::npos,
        "L'affichage des timers doit dépendre de remainingMs, jamais de l'heure système.");
}
