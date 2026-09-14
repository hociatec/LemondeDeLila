void TestCatalogPayloadCodecReadsShelfTree()
{
    const nlohmann::json payload = {
        {"categories", nlohmann::json::array({
            {
                {"id", "sacred-winds"},
                {"name", "Vents sacres"},
                {"children", nlohmann::json::array({
                    {
                        {"id", "board-games"},
                        {"name", "Jeux de plateau"},
                        {"children", nlohmann::json::array()},
                    },
                })},
            },
            {
                {"id", "dancing-winds"},
                {"name", "Vents dansants"},
                {"children", nlohmann::json::array()},
            },
        })},
        {"isAdmin", true},
        {"games", nlohmann::json::array({{
            {"id", "four-winds"},
            {"name", "Les quatre vents"},
            {"minPlayers", 2},
            {"maxPlayers", 4},
            {"categories", nlohmann::json::array({"board-games"})},
        }})},
    };

    const auto catalog = lila::modules::catalog::infrastructure::codec::ReadCatalogPayload(payload);
    const auto& shelves = catalog.shelves;
    Expect(catalog.administrator, "Le droit administrateur du catalogue doit etre conserve");
    Expect(shelves.size() == 2, "Deux etageres catalogue attendues");
    Expect(shelves[0].id == "sacred-winds", "Identifiant de la premiere etagere attendu");
    Expect(shelves[0].children.size() == 1, "Sous-etagere attendue");
    Expect(shelves[0].children[0].name == "Jeux de plateau", "Nom de sous-etagere attendu");
    Expect(shelves[0].children[0].games.size() == 1, "Jeu attache a la sous-etagere attendu");
    Expect(shelves[0].children[0].games[0].id == "four-winds", "Identifiant de jeu attendu");

    auto publicPayload = payload;
    publicPayload.erase("isAdmin");
    Expect(
        !lila::modules::catalog::infrastructure::codec::ReadCatalogPayload(publicPayload)
             .administrator,
        "Le catalogue doit refuser le mode administrateur par defaut");

    bool threw = false;
    try
    {
        static_cast<void>(lila::modules::catalog::infrastructure::codec::ReadCatalogPayload(
            nlohmann::json{{"categories", nlohmann::json::object()}}));
    }
    catch (const std::exception&)
    {
        threw = true;
    }
    Expect(threw, "Un tableau categories invalide doit etre refuse");

    std::cout << "[TEST PASSED] CatalogPayloadCodecReadsShelfTree\n";
}

void TestCatalogApiAuthenticatesCatalogRequest()
{
    lila::modules::session::application::SessionStore sessionStore(
        std::make_unique<InMemorySessionRepository>());
    lila::modules::session::domain::Session session;
    session.userId = lila::shared::domain::UserId{7};
    session.username = "admin";
    session.token = "header.admin.signature";
    session.expiresAt = 4102444800LL;
    sessionStore.Open(session, false);

    FakeRoomWebSocketClient socket;
    FakeRoomTicketProvider tickets;
    lila::shared::network::realtime::AuthenticatedRealtimeApiClient client(
        "wss://example.test/api", "1.2.3", socket, tickets);
    lila::modules::catalog::infrastructure::CatalogApi api(client, sessionStore);

    auto catalogFuture = std::async(
        std::launch::async,
        [&api]() { return api.GetCatalog({}); });
    const auto request = nlohmann::json::parse(socket.WaitForSentPayload(1));
    socket.QueueResponse(nlohmann::json{
        {"type", "catalog.all"},
        {"requestId", request.at("requestId")},
        {"payload", {
            {"categories", nlohmann::json::array()},
            {"games", nlohmann::json::array()},
            {"isAdmin", true},
        }},
    }.dump());

    const auto catalog = catalogFuture.get();
    Expect(catalog.administrator, "Le catalogue authentifie doit conserver le droit admin");
    Expect(request.at("type") == "catalog.all", "Requete catalog.all attendue");
    Expect(
        tickets.requestedScope == lila::shared::network::ws::WsTicketScopeApi,
        "Ticket de portee API attendu pour le catalogue");
    Expect(
        tickets.requestedBearerToken == session.token,
        "JWT du catalogue transmis au fournisseur de ticket attendu");
    Expect(
        socket.headers.at(std::string(lila::shared::network::ws::AuthorizationHeader)) ==
            "Bearer " + session.token,
        "Header Authorization Bearer attendu pour le catalogue");
    Expect(
        socket.headers.at(std::string(lila::shared::network::ws::WsTicketHeader)) == "room-ticket",
        "Header ticket attendu pour le catalogue");

    std::cout << "[TEST PASSED] CatalogApiAuthenticatesCatalogRequest\n";
}

void TestRoomPayloadCodecs()
{
    const auto publicRooms = lila::modules::rooms::infrastructure::codec::ReadPublicRooms({
        {"items", nlohmann::json::array({{
            {"id", 12}, {"name", "Table du soir"}, {"gameType", "four-winds"},
            {"runId", "7"},
            {"status", "waiting"}, {"started", false}, {"spectatorOnly", false},
            {"maxPlayers", 4}, {"playersCount", 2}, {"botsCount", 1},
            {"owner", {{"username", "alice"}}},
        }})},
    });
    Expect(publicRooms.size() == 1, "Une table publique attendue");
    Expect(publicRooms[0].ownerUsername == "alice", "Proprietaire de table attendu");
    Expect(publicRooms[0].playersCount == 2, "Nombre de joueurs attendu");

    const nlohmann::json roomPayload = {
        {"manifest", {
            {"id", "four-winds"}, {"name", "Les quatre vents"},
            {"minPlayers", 2}, {"maxPlayers", 4}}},
        {"room", {
            {"id", 12}, {"name", "Table du soir"}, {"gameType", "four-winds"},
            {"status", "setup"}, {"startedAt", "2026-08-21T18:00:00.000Z"},
            {"isPrivate", false}, {"maxPlayers", 4},
            {"owner", {{"id", 1}, {"username", "alice"}}},
            {"players", nlohmann::json::array({{{"id", 1}, {"username", "alice"}}})},
            {"spectators", nlohmann::json::array()},
            {"bots", nlohmann::json::array({{{"id", 3}, {"name", "LilaBot"}}})},
            {"allowedActions", nlohmann::json::array({"room.snapshot.save", "room.reset", "room.leave"})},
        }},
    };
    const auto room = lila::modules::rooms::infrastructure::codec::ReadRoomState(roomPayload);
    Expect(room.id == 12, "Identifiant d'etat de table attendu");
    Expect(room.runId == 7, "Le runId de table doit etre conserve pour ordonner les etats");
    Expect(room.gameName == "Les quatre vents", "Nom de jeu de la table attendu");
    Expect(room.minPlayers == 2 && room.maxPlayers == 4, "Bornes de joueurs attendues");
    Expect(room.ownerId == 1 && room.ownerName == "alice", "Proprietaire attendu");
    Expect(room.players.size() == 1 && room.bots.size() == 1, "Participants de table attendus");
    Expect(room.started, "startedAt doit marquer la table comme demarree");
    Expect(
        lila::modules::rooms::presentation::RoomShortcutPolicy::Resolve(
            'S', true, false, false, false, room) == "room:save",
        "Controle S doit accepter une table demarree via startedAt");
    Expect(
        lila::modules::rooms::presentation::RoomShortcutPolicy::Resolve(
            'X', false, false, false, false, room) == "room:reset",
        "X doit reinitialiser une table demarree quand le serveur l'autorise");
    Expect(
        lila::modules::rooms::presentation::RoomShortcutPolicy::Resolve(
            'Q', false, false, false, false, room) == "room:leave",
        "Q doit quitter une table demarree quand le serveur l'autorise");

    auto noManifestPayload = roomPayload;
    noManifestPayload.erase("manifest");
    noManifestPayload["room"]["startedAt"] = nullptr;
    const auto noManifestRoom =
        lila::modules::rooms::infrastructure::codec::ReadRoomState(noManifestPayload);
    Expect(
        noManifestRoom.minPlayers == 2,
        "Minimum de secours aligne sur la politique backend attendu");

    std::cout << "[TEST PASSED] RoomPayloadCodecs\n";
}
