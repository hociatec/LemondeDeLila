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
                    {"kind", "pawn"},
                    {"choiceActionsByIndex", nlohmann::json::array({
                        {{"type", "choose_pawn"}, {"payload", {{"pawnId", "flower"}}}},
                        {{"type", "choose_pawn"}, {"payload", {{"pawnId", "stone"}}}},
                    })},
                }},
            }},
        }},
    };

    const auto state = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(BuildGameView(payload));
    const auto selection = lila::modules::gameplay::infrastructure::PawnSelectionDecoder::Decode(
        state.pending);
    Expect(selection.has_value(), "Le choix de pion actif doit etre decode.");
    Expect(selection->label == "Choisissez votre pion.",
        "Le libelle accessible du choix de pion est attendu.");
    Expect(selection->choices.size() == 2, "Tous les pions serveur doivent etre proposes.");
    Expect(selection->choices[1].label == "Un caillou", "Le libelle serveur doit rester intact.");
    Expect(selection->choices[1].action.payload.at("pawnId") == "stone",
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
                {"data", {{"kind", "pawn"}}},
            }},
        }},
    };

    const auto state = lila::modules::gameplay::infrastructure::GameStatePayloadCodec::DecodeState(BuildGameView(payload));
    Expect(!lila::modules::gameplay::infrastructure::PawnSelectionDecoder::Decode(state.pending),
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

    cursor.Reset();
    Expect(cursor.RestoreInitialBaseline({"initial|Configuration"}, 1),
        "Le premier etat de base doit seulement initialiser le curseur.");
    Expect(cursor.ExtractNew({"initial|Configuration"}).empty(),
        "Les evenements de configuration initiaux ne doivent pas etre annonces.");
    cursor.Reset();
    Expect(!cursor.RestoreInitialBaseline({"choice|Baloo a choisi un pion"}, 2),
        "Une mise a jour recue pendant la connexion ne doit pas etre masquee.");
    Expect(cursor.ExtractNew({"choice|Baloo a choisi un pion"}) ==
            std::vector<std::string>({"choice|Baloo a choisi un pion"}),
        "Le choix concurrent d'un autre joueur doit rester annoncable.");
}

void TestOlderGameStateCannotRestoreSetupPrompt()
{
    using lila::modules::gameplay::application::GameStateUpdatePolicy;
    lila::modules::gameplay::domain::GameState roundState;
    roundState.roomId = 42;
    roundState.gameType = "server-driven-game";
    roundState.version = 8;
    roundState.runId = 4;
    roundState.system.setup.phase = "round";
    roundState.system.match.status = "started";

    auto staleSetupState = roundState;
    staleSetupState.version = 7;
    staleSetupState.system.setup.phase = "setup";
    staleSetupState.system.match.status = "setup";
    Expect(!GameStateUpdatePolicy::ShouldApply(roundState, staleSetupState),
        "Un ancien etat de configuration ne doit pas remplacer la manche courante.");

    staleSetupState.version = roundState.version;
    Expect(!GameStateUpdatePolicy::ShouldApply(roundState, staleSetupState),
        "Un etat de configuration de meme version ne doit pas remplacer la manche courante.");

    staleSetupState.version = 0;
    Expect(!GameStateUpdatePolicy::ShouldApply(roundState, staleSetupState),
        "Un etat de configuration sans version ne doit pas remplacer la manche courante.");

    auto nextRoundState = roundState;
    nextRoundState.version = 9;
    Expect(GameStateUpdatePolicy::ShouldApply(roundState, nextRoundState),
        "Un nouvel etat de manche doit rester applicable.");

    auto realResetState = staleSetupState;
    realResetState.version = 9;
    Expect(GameStateUpdatePolicy::ShouldApply(roundState, realResetState),
        "Une reinitialisation plus recente doit rester applicable.");

    auto previousRunState = roundState;
    previousRunState.runId = 3;
    previousRunState.version = 99;
    Expect(!GameStateUpdatePolicy::ShouldApply(roundState, previousRunState),
        "Une ancienne execution doit etre rejetee meme avec une version superieure.");

    auto newRunState = roundState;
    newRunState.runId = 5;
    newRunState.version = 1;
    newRunState.system.match.status = "setup";
    newRunState.system.setup.phase = "setup";
    Expect(GameStateUpdatePolicy::ShouldApply(roundState, newRunState),
        "Une nouvelle execution doit accepter une version remise a un.");

    auto unversionedActiveState = roundState;
    unversionedActiveState.version = 0;
    Expect(!GameStateUpdatePolicy::ShouldApply(roundState, unversionedActiveState),
        "Un etat actif sans version ne doit pas remplacer un etat versionne.");
    auto unidentifiedRunState = roundState;
    unidentifiedRunState.runId = 0;
    unidentifiedRunState.version = 99;
    Expect(!GameStateUpdatePolicy::ShouldApply(roundState, unidentifiedRunState),
        "Un etat sans execution ne doit pas remplacer une execution identifiee.");
    newRunState.version = 0;
    Expect(!GameStateUpdatePolicy::ShouldApply(roundState, newRunState),
        "Une nouvelle execution doit aussi presenter une version valide.");
    auto olderActiveState = roundState;
    olderActiveState.version = roundState.version - 1;
    Expect(!GameStateUpdatePolicy::ShouldApply(roundState, olderActiveState),
        "Un ancien etat actif ne doit pas remplacer une vue recente.");
}
}
void TestCapabilityInformationIsInspectable()
{
    using lila::modules::gameplay::application::info::GameCapabilityTextBuilder;
    lila::modules::gameplay::domain::GameState state;
    state.system.players.push_back({7, "Lila", false, true});
    state.system.players.push_back({8, "Mina", false, true});
    state.system.match.status = "playing";
    state.system.round.number = 2;
    state.system.round.status = "playing";
    state.system.setup.complete = false;
    state.system.setup.phase = "setup";
    state.system.setup.ownerPlayerId = 7;
    lila::modules::gameplay::domain::GameResourcesView resources;
    resources.players.push_back({7, {{"coins", 3}}});
    state.kits.resources = std::move(resources);
    lila::modules::gameplay::domain::GameInventoryView inventory;
    inventory.sets.push_back({"shopping-lists", "owner", {
        {7, {{"melon", 1}, {"jeune-pousse-d-ortie", 1}}, std::nullopt},
        {8, {}, 5}}});
    inventory.sets.push_back({"shopping-baskets", "owner", {
        {7, {{"melon", 1}}, std::nullopt}, {8, {}, 2}}});
    inventory.sets.push_back({"market-items", "owner", {
        {7, {{"epinard", 2}}, std::nullopt}, {8, {}, 4}}});
    state.kits.inventory = std::move(inventory);
    Expect(GameCapabilityTextBuilder::Build(state, "match").find("En cours") != std::string::npos,
        "L'état du match doit être inspectable.");
    Expect(GameCapabilityTextBuilder::Build(state, "setup").find("Lila") != std::string::npos,
        "La configuration doit nommer son propriétaire.");
    Expect(GameCapabilityTextBuilder::Build(state, "resources").find("Pièces") != std::string::npos,
        "Chaque capability doit conserver une présentation générique.");
    Expect(GameCapabilityTextBuilder::Build(state, "inventory:shopping-lists").find(
            "Liste de courses de Lila") != std::string::npos,
        "L doit pouvoir annoncer seulement la liste de courses privée.");
    Expect(GameCapabilityTextBuilder::Build(state, "inventory:shopping-baskets").find(
            "Panier de Lila") != std::string::npos,
        "S doit pouvoir annoncer seulement le panier privé.");
    const auto privateList = GameCapabilityTextBuilder::Build(
        state, "inventory:shopping-lists");
    Expect(privateList.find("Mina") == std::string::npos &&
            privateList.find("masqué") == std::string::npos,
        "L ne doit jamais annoncer les inventaires masqués des autres joueurs.");
    const auto privateInventory = GameCapabilityTextBuilder::Build(
        state, "inventory:market-items");
    Expect(privateInventory.find("Inventaire de Lila") != std::string::npos &&
            privateInventory.find("Epinard : 2") != std::string::npos &&
            privateInventory.find("Mina") == std::string::npos,
        "I doit annoncer uniquement l'inventaire privé du joueur.");

    state.kits.score = lila::modules::gameplay::domain::GameScoreView{};
    state.system.shortcuts.push_back({"S", "S",
        lila::modules::gameplay::domain::GameShortcutKind::Interface,
        "inventory:shopping-baskets", "", "Panier"});
    Expect(lila::modules::gameplay::application::shortcuts::GameGenericShortcutPolicy::ResolveInterface(
            state, "S").empty(),
        "Un raccourci S explicite du jeu doit remplacer le raccourci générique des scores.");
}
