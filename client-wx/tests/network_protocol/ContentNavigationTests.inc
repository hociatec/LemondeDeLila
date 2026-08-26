void TestVaultPayloadCodec()
{
    const auto saveRequest = lila::modules::vault::infrastructure::codec::BuildSaveRequest(42);
    Expect(saveRequest.at("roomId") == 42, "roomId de sauvegarde attendu");
    Expect(!saveRequest.contains("id"), "Le client ne doit pas choisir l'identifiant de sauvegarde");
    const auto abandonRequest = lila::modules::vault::infrastructure::codec::BuildAbandonRequest(42);
    Expect(abandonRequest.at("roomId") == 42, "roomId d'abandon attendu");
    const auto snapshots = lila::modules::vault::infrastructure::codec::ReadSnapshots({
        {"items", nlohmann::json::array({{
            {"id", "snapshot-1"}, {"name", "Sauvegarde 1"},
            {"roomName", "Table du soir"}, {"gameType", "four-winds"},
            {"playersLabel", "alice, bob"}, {"createdAt", "2026-08-21T10:00:00.000Z"},
        }})},
    });
    Expect(snapshots.size() == 1, "Une sauvegarde attendue");
    Expect(snapshots[0].playersLabel == "alice, bob", "Joueurs sauvegardes attendus");
    Expect(
        lila::modules::vault::infrastructure::codec::ReadSavedId({{"id", "snapshot-2"}}) == "snapshot-2",
        "Identifiant sauvegarde attendu");
    Expect(
        lila::modules::vault::infrastructure::codec::ReadRestoredRoomId({{"roomId", 42}}) == 42,
        "Identifiant de table restauree attendu");
    lila::modules::vault::infrastructure::codec::ValidateAbandon({{"ok", true}});

    std::cout << "[TEST PASSED] VaultPayloadCodec\n";
}

void TestRoomAndVaultPresentationState()
{
    using lila::modules::vault::domain::VaultSnapshot;
    using lila::modules::vault::presentation::VaultNavigator;

    VaultNavigator navigator;
    navigator.Reset({
        VaultSnapshot{
            "first", "1000 miles, 21/08/2026 (anian)", "Table 1000 miles restauree",
            "game", "anian", "2026-08-21T20:11:00"},
        VaultSnapshot{"second", "Deuxieme", "Table B", "game", "bob", "date"},
    });
    const auto vaultItems =
        lila::modules::vault::presentation::VaultPresentationModel::BuildItems(navigator, false);
    Expect(
        vaultItems.front().label == wxString::FromUTF8("1000 miles avec anian, 21.08.2026 20:11"),
        "Libelle de sauvegarde aligne sur le client WPF attendu");
    navigator.Select(1);
    Expect(
        navigator.Activate(1) == VaultNavigator::Activation::Restore,
        "Entree doit restaurer directement la sauvegarde selectionnee");
    Expect(navigator.SelectedIndex() == 1, "Selection de sauvegarde restauree attendue");
    navigator.RemoveSelected();
    Expect(navigator.Snapshots().size() == 1, "Suppression locale de sauvegarde attendue");

    const auto create = lila::modules::rooms::presentation::RoomOpenRequest::Create("four-winds");
    Expect(create.gameType == "four-winds", "Requete de creation attendue");
    const auto join = lila::modules::rooms::presentation::RoomOpenRequest::Join(42, true);
    Expect(join.roomId == 42 && join.spectator, "Requete de jonction attendue");
    const auto restore = lila::modules::rooms::presentation::RoomOpenRequest::Restore(43);
    Expect(
        restore.kind == lila::modules::rooms::presentation::RoomOpenRequest::Kind::Restore &&
            restore.roomId == 43 && !restore.spectator,
        "Requete de restauration distincte attendue");

    lila::modules::rooms::presentation::RoomLobbyNavigator lobby;
    lobby.Reset({lila::modules::rooms::domain::PublicRoom{
        42, "Table", "game", "waiting", false, false, 4, 2, 0, "alice"}});
    Expect(lobby.SelectedRoom() != nullptr, "Table publique selectionnee attendue");
    Expect(lobby.SelectedRoom()->id == 42, "Identifiant de table publique attendu");

    std::cout << "[TEST PASSED] RoomAndVaultPresentationState\n";
}

void TestCatalogShelfNavigatorRestoresParentSelection()
{
    using lila::modules::catalog::domain::CatalogGame;
    using lila::modules::catalog::domain::CatalogShelf;
    using lila::modules::catalog::presentation::CatalogShelfNavigator;

    CatalogShelfNavigator navigator;
    navigator.Reset({
        CatalogShelf{"first", "Premiere", {}},
        CatalogShelf{
            "second",
            "Deuxieme",
            {
                CatalogShelf{"child-a", "Enfant A", {}},
                CatalogShelf{"child-b", "Enfant B", {}},
            }},
        CatalogShelf{
            "games",
            "Vents sacres",
            {},
            {
                CatalogGame{"first-game", "Foulees fantastiques"},
                CatalogGame{"second-game", "Morpion"},
            }},
    });

    Expect(navigator.CurrentShelves().size() == 3, "Trois etageres racines attendues");
    Expect(navigator.Enter(1), "L'etagere avec enfants devait etre ouverte");
    Expect(navigator.CurrentShelves().size() == 2, "Deux sous-etageres attendues");
    navigator.Select(1);
    Expect(!navigator.Enter(1), "Une etagere feuille ne devait pas ouvrir de niveau");
    Expect(navigator.Back(), "Le retour au niveau racine devait reussir");
    Expect(navigator.SelectedIndex() == 1, "La selection parente devait etre restauree");
    Expect(!navigator.Back(), "Le niveau racine ne devait pas pouvoir remonter");

    Expect(navigator.Enter(2), "L'etagere de jeux devait etre ouverte");
    Expect(navigator.IsShowingGames(), "La liste des jeux devait etre affichee");
    navigator.Select(1);
    Expect(navigator.Back(), "Le retour depuis les jeux devait reussir");
    Expect(!navigator.IsShowingGames(), "La liste des etageres devait etre restauree");
    Expect(navigator.SelectedIndex() == 2, "L'etagere de jeux devait retrouver le focus");

    std::cout << "[TEST PASSED] CatalogShelfNavigatorRestoresParentSelection\n";
}

void TestStoryBookPayloadAndNavigation()
{
    const nlohmann::json payload = {
        {"games", nlohmann::json::array({
            {
                {"gameType", "first"},
                {"gameName", "Premier jeu"},
                {"withBots", {{"finished", 4}, {"quit", 1}, {"won", 3}, {"lost", 1}}},
                {"withoutBots", {{"finished", 2}, {"quit", 0}, {"won", 1}, {"lost", 1}}},
            },
            {
                {"gameType", "second"},
                {"gameName", "Deuxieme jeu"},
                {"withBots", {{"finished", 8}, {"quit", 2}, {"won", 5}, {"lost", 3}}},
                {"withoutBots", {{"finished", 6}, {"quit", 1}, {"won", 4}, {"lost", 2}}},
            },
        })},
    };

    auto games = lila::modules::storybook::infrastructure::codec::ReadStoryBookPayload(payload);
    Expect(games.size() == 2, "Deux jeux du livre des contes attendus");
    Expect(games[1].withoutBots.won == 4, "Statistiques sans bots attendues");

    lila::modules::storybook::presentation::StoryBookNavigator navigator;
    navigator.OpenGames(std::move(games));
    Expect(navigator.Activate(1), "Ouverture des modes attendue");
    Expect(navigator.Activate(1), "Ouverture des details attendue");
    Expect(!navigator.CurrentModeUsesBots(), "Mode sans bots attendu");
    Expect(navigator.CurrentCounts() != nullptr && navigator.CurrentCounts()->finished == 6, "Details du mode attendus");
    navigator.Select(3);
    Expect(navigator.Back(), "Retour aux modes attendu");
    Expect(navigator.SelectedIndex() == 1, "Selection du mode restauree");
    Expect(navigator.Back(), "Retour aux jeux attendu");
    Expect(navigator.SelectedIndex() == 1, "Selection du jeu restauree");

    bool rejected = false;
    try
    {
        static_cast<void>(lila::modules::storybook::infrastructure::codec::ReadStoryBookPayload(
            nlohmann::json{{"games", nlohmann::json::array({{{"gameType", "bad"}}})}}));
    }
    catch (const std::exception&)
    {
        rejected = true;
    }
    Expect(rejected, "Un jeu incomplet devait etre refuse");

    std::cout << "[TEST PASSED] StoryBookPayloadAndNavigation\n";
}

void TestLeaderboardPayloadAndNavigation()
{
    const nlohmann::json gamesPayload = {
        {"games", nlohmann::json::array({
            {{"gameType", "first"}, {"gameName", "Premier jeu"}},
            {{"gameType", "second"}, {"gameName", "Deuxieme jeu"}},
        })},
    };
    auto games = lila::modules::leaderboard::infrastructure::codec::ReadGamesPayload(gamesPayload);
    Expect(games.size() == 2, "Deux jeux de classement attendus");

    nlohmann::json entries = nlohmann::json::array();
    for (int index = 0; index < 11; ++index)
    {
        entries.push_back({
            {"userId", index + 1},
            {"username", "player-" + std::to_string(index + 1)},
            {"wins", 20 - index},
            {"losses", index},
            {"finished", 20},
            {"quit", 0},
        });
    }
    auto top = lila::modules::leaderboard::infrastructure::codec::ReadTopPayload(
        nlohmann::json{{"gameType", "second"}, {"entries", std::move(entries)}});
    Expect(top.entries.size() == 11, "Toutes les entrees valides devaient etre decodees");
    Expect(top.entries.front().wins == 20, "Le nombre de victoires devait etre conserve");

    lila::modules::leaderboard::presentation::LeaderboardNavigator navigator;
    navigator.ResetGames(std::move(games));
    navigator.OpenTop(1, std::move(top));
    Expect(navigator.CurrentGame() != nullptr && navigator.CurrentGame()->gameType == "second", "Jeu classe attendu");
    Expect(navigator.ItemCount() == 10, "Le classement affiche devait etre limite au top 10");
    navigator.Select(9);
    Expect(navigator.Back(), "Retour aux jeux du classement attendu");
    Expect(navigator.SelectedIndex() == 1, "Selection du jeu classe restauree");

    bool rejected = false;
    try
    {
        static_cast<void>(lila::modules::leaderboard::infrastructure::codec::ReadTopPayload(
            nlohmann::json{
                {"gameType", "bad"},
                {"entries", nlohmann::json::array({{
                    {"userId", 1},
                    {"username", "bad"},
                    {"wins", -1},
                    {"losses", 0},
                    {"finished", 0},
                    {"quit", 0},
                }})},
            }));
    }
    catch (const std::exception&)
    {
        rejected = true;
    }
    Expect(rejected, "Une entree de classement negative devait etre refusee");

    std::cout << "[TEST PASSED] LeaderboardPayloadAndNavigation\n";
}

