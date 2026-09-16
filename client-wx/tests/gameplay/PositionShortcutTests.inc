void TestBoardPositionShortcuts()
{
    using lila::modules::gameplay::application::grid::GridCoordinate;
    Expect(GridCoordinate(0, 0) == "A1" && GridCoordinate(0, 1) == "A2" &&
        GridCoordinate(1, 0) == "B1" && GridCoordinate(2, 2) == "C3" &&
        GridCoordinate(25, 0) == "Z1" && GridCoordinate(26, 0) == "AA1",
        "Les cases doivent utiliser des coordonnées compactes, sans nom de plateau.");
    auto payload = BuildGameView({
        {"roomId", 81},
        {"viewerPlayerId", 7},
        {"gameType", "position-game"}});
    payload["system"]["players"]["all"] = nlohmann::json::array({
        {{"id", 7}, {"username", "Lila"}},
        {{"id", 8}, {"username", "Mina"}}});
    payload["kits"] = {{"movement", {{"tracks", {{"main", {
        {"spaces", 20}, {"positions", {{"7", 4}, {"8", 9}}}}}}}}}};

    const auto state =
        lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(payload);
    using lila::modules::gameplay::application::shortcuts::GameGenericShortcutPolicy;
    using lila::modules::gameplay::application::info::GameCapabilityTextBuilder;

    Expect(state.viewerPlayerId == 7,
        "L'identité du joueur doit être conservée dans la vue de jeu.");
    Expect(GameGenericShortcutPolicy::ResolveInterface(state, "P") == "position" &&
            GameGenericShortcutPolicy::ResolveInterface(state, "SHIFT+P") == "positions",
        "p et Maj+P doivent annoncer les positions dans tous les jeux de plateau.");
    Expect(GameCapabilityTextBuilder::Build(state, "position") ==
            "Votre position : case 4.\n",
        "p doit annoncer uniquement la position du joueur.");
    const auto allPositions = GameCapabilityTextBuilder::Build(state, "positions");
    const auto ranking = GameCapabilityTextBuilder::Build(state, "race-ranking");
    Expect(ranking == "Classement de la course\nRang 1 — Mina : 10 cases avant l'arrivée.\nRang 2 — Lila : 15 cases avant l'arrivée.\n",
        "Le classement doit ordonner les joueurs et annoncer la distance restante, pas répéter P.");
    Expect(allPositions.find("Lila : case 4.") != std::string::npos &&
            allPositions.find("Mina : case 9.") != std::string::npos,
        "Maj+P doit annoncer la position de tous les joueurs.");

    payload["kits"]["movement"]["tracks"]["main"]["positions"] =
        nlohmann::json::object();
    const auto initialState =
        lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(payload);
    Expect(GameCapabilityTextBuilder::Build(initialState, "position") ==
            "Votre position : case 0.\n",
        "p doit annoncer la case 0 avant le premier déplacement.");
    const auto initialPositions = GameCapabilityTextBuilder::Build(initialState, "positions");
    const auto tiedRanking = GameCapabilityTextBuilder::Build(initialState, "race-ranking");
    Expect(tiedRanking.find("Rang 1 — Lila") != std::string::npos &&
            tiedRanking.find("Rang 1 — Mina") != std::string::npos &&
            tiedRanking.find("Rang 2") == std::string::npos,
        "Les joueurs à égalité doivent partager le même rang.");
    Expect(initialPositions.find("Lila : case 0.") != std::string::npos &&
            initialPositions.find("Mina : case 0.") != std::string::npos,
        "Maj+P doit annoncer tous les joueurs en case 0 au départ.");
}
