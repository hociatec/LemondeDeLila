void TestKnownCapabilitiesAreTyped()
{
    auto payload = V2Payload({{"roomId", 71}, {"runId", 9}, {"gameType", "capability-game"}});
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
        {"pawns", {{"sets", {{"racers", {{"positions", {{"pawn-a", 4}}},
            {"owners", {{"pawn-a", 7}}}}}}}}},
        {"score", {{"byPlayer", {{"7", 12}}},
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
    Expect(state.kits.cards && state.kits.cards->decks[0].count == 12 &&
            state.kits.cards->discards[0].cards[0].label == "Carte une" &&
            state.kits.cards->hands[0].players[1].count == 4 &&
            !state.kits.cards->hands[0].players[1].cardsVisible &&
            state.kits.cards->zones[0].cards[0].id == "c3",
        "Toutes les zones de cartes doivent être décodées dans des modèles explicites.");
    Expect(state.kits.movement && state.kits.movement->tracks[0].positions.at("pawn-a") == 4,
        "Movement doit être décodé dans un modèle typé.");
    Expect(state.kits.pawns && state.kits.pawns->pawns[0].ownerId == 7,
        "Les propriétaires de pions doivent être typés.");
    Expect(state.kits.score && state.kits.resources && state.kits.counters && state.kits.status,
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
        "Une capacité future doit rester disponible dans le fallback typé générique.");
}

void TestPendingMultipleWorkflowsUseOneExplicitAction()
{
    auto payload = V2Payload({{"roomId", 72}, {"gameType", "choice-game"}, {"state", {
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

void TestEventsHaveStableIdentityAndAccessibleText()
{
    auto payload = V2Payload({{"roomId", 73}, {"gameType", "event-game"}});
    payload["system"]["players"]["all"] = nlohmann::json::array({
        {{"id", 7}, {"username", "Lila"}}});
    payload["system"]["events"]["latestByType"] = {
        {"dice.rolled", {{"id", "42:0"}, {"type", "dice.rolled"},
            {"actorId", 7}, {"occurredAtMs", 100}, {"data", {{"total", 8}}}}}};
    const auto state = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(payload);
    Expect(state.logMessages.size() == 1 && state.logMessages[0].find("id:42:0|") == 0,
        "L'identité backend doit précéder le message d'historique.");
    Expect(state.logMessages[0].find("Lila lance les dés : 8") != std::string::npos &&
            state.logMessages[0].find('{') == std::string::npos,
        "Un événement doit produire une phrase accessible sans dump JSON.");
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
