void TestBoardPositionShortcuts()
{
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
    Expect(initialPositions.find("Lila : case 0.") != std::string::npos &&
            initialPositions.find("Mina : case 0.") != std::string::npos,
        "Maj+P doit annoncer tous les joueurs en case 0 au départ.");
}
