void TestKnownCapabilitiesAreTyped()
{
    auto payload = BuildGameView({{"roomId", 71}, {"runId", 9}, {"gameType", "capability-game"}});
    payload["system"]["setup"]["values"] = {
        {"targetScore", 25},
        {"teams", nlohmann::json::array({"red", "blue"})}};
    payload["kits"] = {
        {"cards", {
            {"decks", {{"draw", {{"count", 12}}}}},
            {"discards", {{"draw", {{"count", 1}, {"cards", nlohmann::json::array({
                {{"id", "c1"}, {"label", "Carte une"}}})}}}}},
            {"hands", {{"players", {{"visibility", "owner"}, {"byPlayer", {
                {"7", nlohmann::json::array({{{"id", "c2"}, {"label", "Carte deux"}}})},
                {"8", {{"count", 4}}}}}}}}},
            {"zones", {{"river", {{"visibility", "public"}, {"cards", nlohmann::json::array({"c3"})}}}}}}},
        {"movement", {{"tracks", {{"main", {{"spaces", 20},
            {"positions", {{"pawn-a", 4}}}}}}}}},
        {"pawns", {{"sets", {{"racers", {{"definitions", nlohmann::json::array({
                {{"id", "pawn-a"}, {"label", "Pion officiel"}}})},
            {"positions", {{"pawn-a", 4}}}, {"owners", {{"pawn-a", 7}}}}}}}}},
        {"score", {{"label", "Prestige"}, {"unit", {{"singular", "étoile"}, {"plural", "étoiles"}}},
            {"byPlayer", {{"7", 12}}},
            {"leaderboard", nlohmann::json::array({{{"playerId", 7}, {"score", 12}, {"rank", 1}}})}}},
        {"resources", {{"coins", {{"7", 3}}}}},
        {"counters", {{"rounds", 2}}},
        {"status", {{"byId", {{"protected", {{"7", {{"remaining", 1}}}}}}}}},
        {"inventory", {{"bags", {{"visibility", "public"},
            {"byPlayer", {{"7", nlohmann::json::array({"apple", "apple"})}}}}}}},
        {"economy", {{"market", {{"currency", "coins"}, {"prices", {{"apple", 2}}}}}}},
        {"ownership", {{"properties", {{"owners", {{"house", nlohmann::json::array({7})}}}}}}},
        {"collections", {{"families", {{"byPlayer", {{"7", {{"total", 1},
            {"groups", {{"red", {{"count", 1}, {"items", nlohmann::json::array({"fox"})}}}}}}}}}}}}},
        {"quiz", {{"sessions", {{"quiz-1", {{"phase", "question"},
            {"question", {{"prompt", "Deux plus deux ?"},
                {"choices", nlohmann::json::array({"3", "4"})}}}}}}}}},
        {"submissions", {{"stage", "collecting"}, {"sessions", {{"s1", {
            {"kind", "text"}, {"participantPlayerIds", nlohmann::json::array({7})},
            {"pendingPlayerIds", nlohmann::json::array({7})},
            {"valuesByPlayerId", {{"7", {{"cardId", "card-7"}, {"label", "Carte sept"}}}}},
            {"ownValue", {{"playerId", 7}}}}}}}}},
        {"future-kit", {{"opaqueValue", 9}}}};
    payload["effect"] = {{"source", {{"playerId", 7}}}, {"status", "resolving"}};
    payload["timers"] = {{"turn", {{"remainingMs", 5000}, {"paused", false}}}};

    const auto state = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(payload);
    Expect(state.runId == 9, "Le runId serveur doit isoler les executions successives d'une room.");
    Expect(state.system.setup.values.size() == 2 &&
            std::get<double>(state.system.setup.values.at("targetScore").value) == 25 &&
            std::get<lila::modules::gameplay::domain::GameValue::Array>(
                state.system.setup.values.at("teams").value).size() == 2,
        "Les valeurs de configuration doivent etre decodees dans une collection typee.");
    Expect(lila::modules::gameplay::application::info::GameCapabilityTextBuilder::Build(
            state, "setup").find("Target score : 25") != std::string::npos,
        "La configuration typee doit rester consultable sans rendu JSON.");
    Expect(state.kits.cards && state.kits.cards->decks[0].count == 12 &&
            state.kits.cards->discards[0].cards[0].label == "Carte une" &&
            state.kits.cards->hands[0].players[1].count == 4 &&
            !state.kits.cards->hands[0].players[1].cardsVisible &&
            state.kits.cards->zones[0].cards[0].id == "c3",
        "Toutes les zones de cartes doivent être décodées dans des modèles explicites.");
    Expect(lila::modules::gameplay::application::info::GameCapabilityTextBuilder::Build(
            state, "hand") == "Vous avez 1 carte en main.",
        "Le raccourci generique E doit annoncer uniquement la taille de la main.");
    Expect(lila::modules::gameplay::application::info::GameCapabilityTextBuilder::Build(
            state, "discard") == "Carte au-dessus : Carte une.",
        "Un jeu de cartes doit pouvoir annoncer la carte au-dessus de la defausse.");
    Expect(state.kits.movement && state.kits.movement->tracks[0].positions.at("pawn-a") == 4,
        "Movement doit être décodé dans un modèle typé.");
    Expect(state.kits.pawns && state.kits.pawns->pawns[0].ownerId == 7 &&
            state.kits.pawns->pawns[0].label == "Pion officiel",
        "Les propriétaires et labels officiels de pions doivent être typés.");
    Expect(state.kits.score && state.kits.score->label == "Prestige" &&
            state.kits.score->UnitFor(1) == "étoile" &&
            state.kits.score->UnitFor(12) == "étoiles" && state.kits.resources &&
            state.kits.counters && state.kits.status,
        "Les valeurs joueur connues doivent être typées.");
    Expect(state.kits.inventory && state.kits.economy && state.kits.ownership &&
            state.kits.collections,
        "Les capacités d'objets connues doivent être typées.");
    Expect(state.kits.quiz && state.kits.submissions,
        "Quiz et soumissions doivent être typés.");
    Expect(state.kits.submissions->sessions[0].visibleValues.at(7).kind ==
            lila::modules::gameplay::domain::GameSubmissionValueKind::Card &&
            state.kits.submissions->sessions[0].ownValue &&
            state.kits.submissions->sessions[0].ownValue->playerId == 7,
        "Les valeurs standard de soumission doivent exposer leur nature sans introspection JSON.");
    Expect(state.effect && state.timers.size() == 1,
        "Effets et minuteurs doivent être typés.");
    Expect(state.kits.Unknown("future-kit") != nullptr,
        "Une capacité future doit rester disponible dans l'extension typée générique.");
}

void TestEmptyV2KitsAndCapabilitiesRemainValid()
{
    auto payload = BuildGameView({{"roomId", 79}, {"gameType", "empty-kits"}});
    payload["kits"] = nlohmann::json::object();
    const auto empty = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(
        payload);
    Expect(!empty.kits.cards && !empty.kits.grid,
        "kits vide doit rester une projection V2 valide sans capability active.");

    payload["kits"] = {{"cards", nlohmann::json::object()},
        {"grid", nlohmann::json::object()}, {"score", nlohmann::json::object()},
        {"quiz", nlohmann::json::object()}};
    const auto present = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(
        payload);
    Expect(present.kits.cards && present.kits.grid && present.kits.score && present.kits.quiz,
        "Une capability présente sous forme d'objet vide ne doit pas être confondue avec null.");
}

void TestPendingMultipleWorkflowsUseOneExplicitAction()
{
    auto payload = BuildGameView({{"roomId", 72}, {"gameType", "choice-game"}, {"state", {
        {"actions", nlohmann::json::array({{{"type", "choice.resolve"},
            {"payload", {{"value", nlohmann::json::array()}}}}})},
        {"pending", {{"type", "choice"}, {"choices", nlohmann::json::array({"A", "B", "C"})},
            {"data", {{"kind", "ordering"}, {"min", 3}, {"max", 3},
                {"options", nlohmann::json::array({10, 20, 30})},
                {"selectionActionType", "choice.resolve"}}}}}}}});
    const auto state = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(payload);
    Expect(state.pending && state.pending->ordering && state.pending->multipleSelection,
        "Ordering doit rester distinct d'une simple sélection multiple.");
    Expect(state.pending->selectionAction && state.pending->viewerActionable,
        "Le workflow multiple doit utiliser son action serveur explicite.");
    Expect(std::get<double>(state.pending->choices[1].value.value) == 20,
        "Les valeurs de choix ne doivent pas rester du JSON dans le domaine.");
}

void TestPendingSelectionPolicy()
{
    using lila::modules::gameplay::application::GamePendingSelectionPolicy;
    using lila::modules::gameplay::domain::GamePending;
    using lila::modules::gameplay::domain::GamePendingChoice;
    using lila::modules::gameplay::domain::GameValue;

    auto unboundedPayload = BuildGameView({{"roomId", 74}, {"gameType", "choice-game"}, {"state", {
        {"actions", nlohmann::json::array({{{"type", "choice.resolve"},
            {"payload", {{"value", nlohmann::json::array()}}}}})},
        {"pending", {{"type", "choice"}, {"choices", nlohmann::json::array({"A", "B", "C"})},
            {"data", {{"kind", "many"}, {"min", 0}, {"max", nullptr},
                {"selectionActionType", "choice.resolve"}}}}}}}});
    const auto unbounded = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(
        unboundedPayload);
    Expect(unbounded.pending && unbounded.pending->maximumSelections == 3,
        "Une borne max nulle doit autoriser tous les choix disponibles.");

    GamePending passive;
    passive.viewerActionable = false;
    passive.selectionAction = lila::modules::gameplay::domain::GameAction{
        "resolve", {}, {}, nlohmann::json::object(), false, false};
    Expect(!GamePendingSelectionPolicy::HasActionableChoices(passive),
        "Un pending vide et passif ne doit jamais devenir une cible de focus.");

    const GameValue alpha{std::string("alpha")};
    const GameValue beta{std::string("beta")};
    const GameValue gamma{std::string("gamma")};
    const std::vector<GamePendingChoice> choices{
        {"Beta", beta, std::nullopt}, {"Gamma", gamma, std::nullopt}};
    const auto order = GamePendingSelectionPolicy::RestoreOrder(choices, {alpha, beta});
    Expect(order == std::vector<std::size_t>({0, 1}) &&
            GamePendingSelectionPolicy::RestoreChoiceIndex(choices, alpha) == 0 &&
            GamePendingSelectionPolicy::RestoreChoiceIndex(choices, gamma) == 1,
        "La restauration doit ignorer les anciens choix disparus et conserver les choix présents.");
}

void TestEventsHaveStableIdentityAndAccessibleText()
{
    auto payload = BuildGameView({{"roomId", 73}, {"gameType", "event-game"}});
    payload["system"]["players"]["all"] = nlohmann::json::array({
        {{"id", 7}, {"username", "Lila"}}});
    payload["system"]["events"]["latestByType"] = {
        {"dice.rolled", {{"id", "42:0"}, {"type", "dice.rolled"},
            {"actorId", 7}, {"occurredAtMs", 100}, {"sequence", 17},
            {"data", {{"total", 8}, {"message", "Lila lance les dés : 8."}}}}},
        {"score.changed", {{"id", "42:1"}, {"type", "score.changed"},
            {"occurredAtMs", 101}, {"sequence", 18},
            {"data", {{"playerId", 7}, {"value", 12},
                {"message", "Lila a maintenant 12 points."}}}}}};
    payload["system"]["events"]["recent"] = nlohmann::json::array({
        payload["system"]["events"]["latestByType"]["score.changed"],
        payload["system"]["events"]["latestByType"]["dice.rolled"]});
    const auto state = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(payload);
    Expect(state.system.events.size() == 2 && state.system.events[0].details.total == "8" &&
            state.system.events[1].details.playerId == 7 &&
            state.system.events[1].details.value == "12",
        "Les payloads des événements connus doivent être décodés avant leur présentation.");
    std::vector<std::string> logMessages;
    for (const auto& event : state.system.events)
        logMessages.push_back(event.Identity() + "|" +
            lila::modules::gameplay::presentation::events::GameEventPresenter::Present(
                event, state.system.players));
    Expect(logMessages.size() == 2 && logMessages[0].find("id:42:0|") == 0,
        "L'identifiant versionné doit dédupliquer sans confondre deux états successifs.");
    Expect(logMessages[0].find("Lila lance les dés : 8") != std::string::npos &&
            logMessages[1].find("Lila a maintenant 12 points") != std::string::npos &&
            logMessages[0].find('{') == std::string::npos,
        "Le client doit restituer mot pour mot le message accessible du backend.");
}

void TestTechnicalEngineEventsStayOutOfPlayerHistory()
{
    using lila::modules::gameplay::domain::GameEngineEvent;
    using lila::modules::gameplay::presentation::events::GameEventPresenter;
    const std::vector<lila::modules::gameplay::domain::GamePlayer> players{
        {7, "Lila", false, true}};
    for (const std::string type : {
             "game.command.accepted", "game.configured", "game.message",
             "game.phase.changed", "match.started", "turn.ended",
             "card.played", "card.drawn", "card.received", "card.discarded"})
    {
        GameEngineEvent event;
        event.type = type;
        event.actorId = 7;
        event.details.playerId = 7;
        Expect(GameEventPresenter::Present(event, players).empty(),
            "Un evenement technique sans message serveur ne doit pas polluer l'historique.");
    }
    GameEngineEvent narrated;
    narrated.type = "game.message";
    narrated.details.message = "Vous jouez LAMA.";
    Expect(GameEventPresenter::Present(narrated, players) == "Vous jouez LAMA.",
        "La narration explicite du serveur doit rester prioritaire.");
    GameEngineEvent tokens;
    tokens.type = "score.changed";
    tokens.details.playerId = 7;
    tokens.details.value = "12";
    Expect(GameEventPresenter::Present(tokens, players).empty(),
        "Le client ne doit jamais reconstruire une annonce absente du backend.");
    tokens.details.announce = false;
    Expect(GameEventPresenter::Present(tokens, players).empty(),
        "Un evenement silencieux du serveur ne doit pas entrer dans l'historique.");
}

void TestGridActionResolutionUsesBoardAndCell()
{
    using lila::modules::gameplay::application::grid::GameGridActionResolver;
    using lila::modules::gameplay::application::grid::GameGridTarget;
    std::vector<lila::modules::gameplay::domain::GameAction> actions{
        {"play", "", "", {{"boardId", "left"}, {"cellId", "A1"}}},
        {"play", "", "", {{"boardId", "right"}, {"cellId", "A1"}}}};
    const auto resolved = GameGridActionResolver::Resolve(
        actions, GameGridTarget{"right", "A1", 0, 0});
    Expect(resolved && resolved->payload.at("boardId") == "right",
        "La résolution d'une cellule doit inclure son boardId.");
}
