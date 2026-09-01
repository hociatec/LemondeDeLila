void TestRoomPresentationMatchesWpfWaitingTable()
{
    lila::modules::rooms::domain::RoomState room;
    room.id = 42;
    room.name = "Table d'Alice";
    room.gameType = "four-winds";
    room.gameName = "Les quatre vents";
    room.status = "setup";
    room.minPlayers = 2;
    room.maxPlayers = 4;
    room.players.push_back({7, "alice"});
    room.players.push_back({8, "bob"});
    room.allowedActions = {
        "room.start", "bot.add", "room.info", "room.players",
        "room.toggle-privacy", "room.set-role", "room.reset", "room.snapshot.save",
        "room.leave"};

    using Model = lila::modules::rooms::presentation::RoomPresentationModel;
    using ShortcutPolicy = lila::modules::rooms::presentation::RoomShortcutPolicy;
    using EventType = lila::modules::rooms::domain::RoomEventType;
    const auto items = Model::BuildItems(room);
    Expect(!items.empty() && items.front().id == "room:start", "Nom du jeu activable en premier attendu");
    Expect(items.front().label == wxString::FromUTF8("Les quatre vents"), "Nom du jeu WPF attendu");
    Expect(Model::ActionForId(items.front().id) == Model::Action::Start, "Entree doit demarrer la table");
    Expect(
        std::any_of(items.begin(), items.end(), [](const auto& item) { return item.id == "room:add-bot"; }),
        "Action ajouter un bot attendue");
    Expect(
        std::any_of(items.begin(), items.end(), [](const auto& item) { return item.id == "room:save"; }),
        "Sauvegarde proposee quand le serveur l'autorise attendue");
    Expect(
        ShortcutPolicy::Resolve('H', true, false, false, false, room) == "room:privacy",
        "Controle H doit changer la visibilite pour le proprietaire");
    Expect(
        ShortcutPolicy::Resolve('S', true, false, false, false, room) == "room:save",
        "Controle S doit transmettre la tentative au serveur");
    Expect(
        ShortcutPolicy::Resolve('Q', false, false, false, false, room) == "room:leave",
        "Q doit quitter une table avant le demarrage");
    Expect(
        ShortcutPolicy::Resolve('X', false, false, false, false, room).empty(),
        "X ne doit rien faire avant le demarrage");
    Expect(
        Model::BuildPlayers(room) == wxString::FromUTF8(
            "Joueurs : alice, bob. Spectateurs : aucun. Bots : aucun."),
        "Annonce complete des joueurs attendue");
    Expect(
        Model::BuildStatus(room).Contains(wxString::FromUTF8("Table prête")),
        "Table prête seulement une fois le minimum serveur atteint attendu");
    Expect(
        Model::ShouldRepeatAnnouncement(EventType::Info) &&
            !Model::ShouldRepeatAnnouncement(EventType::Announcement),
        "I doit pouvoir réannoncer les informations sans répéter les annonces spontanées");

    auto waitingRoom = room;
    waitingRoom.players.resize(1);
    waitingRoom.allowedActions.erase(
        std::remove(waitingRoom.allowedActions.begin(), waitingRoom.allowedActions.end(), "room.start"),
        waitingRoom.allowedActions.end());
    const auto waitingItems = Model::BuildItems(waitingRoom);
    Expect(
        !waitingItems.empty() && waitingItems.front().id == "room:game",
        "Demarrage absent tant que le backend ne l'autorise pas attendu");
    Expect(
        Model::ActionForId(waitingItems.front().id) == Model::Action::ShowGameStatus,
        "Entree sans assez de participants doit annoncer le statut de la table");
    Expect(
        Model::BuildStatus(waitingRoom) == wxString::FromUTF8(
            "Pour jouer, il faut être au minimum 2 participants (actuellement 1)."),
        "Minimum serveur explicite attendu");

    room.bots.push_back({9, "Spirit"});
    Expect(
        Model::BuildDetails(room).Contains(wxString::FromUTF8("Bots : Spirit")),
        "Bot synchronise visible dans les details de table attendu");

    auto restrictedRoom = room;
    restrictedRoom.allowedActions.erase(
        std::remove(restrictedRoom.allowedActions.begin(), restrictedRoom.allowedActions.end(), "room.players"),
        restrictedRoom.allowedActions.end());
    restrictedRoom.allowedActions.erase(
        std::remove(restrictedRoom.allowedActions.begin(), restrictedRoom.allowedActions.end(), "room.leave"),
        restrictedRoom.allowedActions.end());
    const auto restrictedItems = Model::BuildItems(restrictedRoom);
    Expect(
        std::none_of(restrictedItems.begin(), restrictedItems.end(), [](const auto& item)
        {
            return item.id == "room:players" || item.id == "room:leave";
        }),
        "Raccourcis limites aux actions autorisees attendus");

    room.status = "started";
    for (const std::string_view setupAction : {
             "room.start", "bot.add", "bot.remove", "room.set-role"})
    {
        room.allowedActions.erase(
            std::remove(
                room.allowedActions.begin(), room.allowedActions.end(), setupAction),
            room.allowedActions.end());
    }
    const auto startedItems = Model::BuildItems(room);
    Expect(startedItems.front().id == "room:game", "Jeu non redemarrable apres demarrage attendu");
    Expect(
        std::any_of(startedItems.begin(), startedItems.end(), [](const auto& item) { return item.id == "room:save"; }),
        "Sauvegarde disponible pendant la partie attendue");
    Expect(
        std::none_of(startedItems.begin(), startedItems.end(), [](const auto& item) { return item.id == "room:add-bot"; }),
        "Ajout de bot masque pendant la partie attendu");
    Expect(
        ShortcutPolicy::Resolve('S', true, false, false, false, room) == "room:save",
        "Controle S doit sauvegarder une partie demarree");
    Expect(
        ShortcutPolicy::Resolve('Q', false, false, false, false, room) == "room:leave",
        "Q doit quitter une table pendant une partie lancee");
    Expect(
        ShortcutPolicy::Resolve('I', false, false, false, false, room) == "room:info",
        "I doit rester aligne sur l'autorisation serveur pendant la partie");
    Expect(
        ShortcutPolicy::Resolve('X', false, false, false, false, room) == "room:reset",
        "X doit reinitialiser une table pendant une partie lancee");

    room.allowedActions.erase(
        std::remove(room.allowedActions.begin(), room.allowedActions.end(), "room.toggle-privacy"),
        room.allowedActions.end());
    Expect(
        ShortcutPolicy::Resolve('H', true, false, false, false, room).empty(),
        "Controle H doit respecter les permissions serveur");

    std::cout << "[TEST PASSED] RoomPresentationMatchesWpfWaitingTable\n";
}
