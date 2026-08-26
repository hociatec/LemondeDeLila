void TestRoomSessionGatewayUsesWpfHandshakeContract()
{
    lila::modules::session::application::SessionStore sessionStore(
        std::make_unique<InMemorySessionRepository>());
    lila::modules::session::domain::Session session;
    session.userId = lila::shared::domain::UserId{7};
    session.username = "alice";
    session.token = "header.payload.signature";
    session.expiresAt = 4102444800LL;
    sessionStore.Open(session, false);

    FakeRoomWebSocketClient socket;
    socket.responses.push_back(nlohmann::json{
        {"type", "room.created"},
        {"roomId", 42},
        {"payload", {
            {"manifest", {{"id", "four-winds"}, {"name", "Les quatre vents"}}},
            {"room", {
                {"id", 42}, {"name", "Table d'Alice"}, {"gameType", "four-winds"},
                {"status", "waiting"}, {"isPrivate", false}, {"maxPlayers", 4},
                {"players", nlohmann::json::array({{{"id", 7}, {"username", "alice"}}})},
                {"spectators", nlohmann::json::array()},
                {"bots", nlohmann::json::array()},
                {"allowedActions", nlohmann::json::array({"bot.add"})},
            }},
        }},
    }.dump());
    FakeRoomTicketProvider tickets;
    lila::modules::rooms::infrastructure::RoomSessionGateway gateway(
        "wss://example.test/ws", socket, tickets, sessionStore);

    const auto room = gateway.Create("four-winds", {});
    Expect(room.id == 42, "Table creee attendue");
    Expect(socket.endpoint == "wss://example.test/ws", "Endpoint room /ws attendu");
    Expect(
        tickets.requestedScope == lila::shared::network::ws::WsTicketScopeRoom,
        "Ticket de portee room attendu");
    Expect(
        tickets.requestedBearerToken == session.token,
        "JWT transmis au fournisseur de ticket attendu");
    Expect(
        socket.headers.at(std::string(lila::shared::network::ws::AuthorizationHeader)) ==
            "Bearer " + session.token,
        "Header Authorization Bearer attendu");
    Expect(
        socket.headers.at(std::string(lila::shared::network::ws::WsTicketHeader)) == "room-ticket",
        "Header ticket room attendu");
    Expect(
        socket.headers.contains(std::string(lila::shared::network::ws::ClientVersionHeader)),
        "Version client attendue dans le handshake");
    Expect(socket.sentPayloads.size() == 1, "Une commande room.create attendue");
    const auto command = nlohmann::json::parse(socket.sentPayloads.front());
    Expect(command.at("type") == "room.create", "Type room.create attendu");
    Expect(command.at("payload").at("gameType") == "four-winds", "gameType cree attendu");

    socket.responses.push_back(nlohmann::json{
        {"type", "room.updated"},
        {"roomId", 42},
        {"payload", {
            {"manifest", {
                {"id", "four-winds"}, {"name", "Les quatre vents"},
                {"minPlayers", 2}, {"maxPlayers", 4}}},
            {"room", {
                {"id", 42}, {"name", "Table d'Alice"}, {"gameType", "four-winds"},
                {"status", "setup"}, {"isPrivate", false}, {"maxPlayers", 4},
                {"owner", {{"id", 7}, {"username", "alice"}}},
                {"players", nlohmann::json::array({{{"id", 7}, {"username", "alice"}}})},
                {"spectators", nlohmann::json::array()},
                {"bots", nlohmann::json::array()},
                {"allowedActions", nlohmann::json::array({"bot.add"})},
            }},
        }},
    }.dump());
    const auto startedPayload = nlohmann::json{
        {"type", "room.updated"},
        {"roomId", 42},
        {"payload", {
            {"manifest", {
                {"id", "four-winds"}, {"name", "Les quatre vents"},
                {"minPlayers", 2}, {"maxPlayers", 4}}},
            {"room", {
                {"id", 42}, {"name", "Table d'Alice"}, {"gameType", "four-winds"},
                {"status", "started"}, {"isPrivate", false}, {"maxPlayers", 4},
                {"owner", {{"id", 7}, {"username", "alice"}}},
                {"players", nlohmann::json::array({{{"id", 7}, {"username", "alice"}}})},
                {"spectators", nlohmann::json::array()},
                {"bots", nlohmann::json::array()},
                {"allowedActions", nlohmann::json::array({"room.reset", "room.snapshot.save"})},
            }},
        }},
    }.dump();
    auto startFuture = std::async(
        std::launch::async,
        [&gateway]() { gateway.Execute({lila::modules::rooms::domain::RoomCommand::Start}, {}); });
    const auto startCommand = nlohmann::json::parse(socket.WaitForSentPayload(2));
    Expect(startCommand.at("type") == "room.start", "Commande room.start attendue");
    const auto setup = gateway.ReceiveEvent({});
    Expect(
        setup.type == lila::modules::rooms::domain::RoomEventType::StateUpdated &&
            setup.room.has_value() && setup.room->status == "setup",
        "Premier evenement room.updated attendu");
    socket.QueueResponse(nlohmann::json{
        {"type", "room.ack"},
        {"payload", {
            {"action", "room.start"},
            {"traceId", startCommand.at("payload").at("_trace").at("id")}}},
    }.dump());
    Expect(
        gateway.ReceiveEvent({}).type == lila::modules::rooms::domain::RoomEventType::Ignored,
        "Accuse de reception ignore par le flux metier attendu");
    startFuture.get();
    socket.QueueResponse(startedPayload);
    const auto started = gateway.ReceiveEvent({});
    Expect(
        started.room.has_value() && started.room->status == "started",
        "Table demarree attendue dans le flux d'evenements");

    socket.responses.push_back(nlohmann::json{
        {"type", "room.intent"},
        {"payload", {{"type", "announcement"}, {"payload", {{"message", "Partie demarree"}}}}},
    }.dump());
    const auto privacyPayload = nlohmann::json{
        {"type", "room.privacy"},
        {"payload", {{"isPrivate", true}}},
    }.dump();
    auto privacyFuture = std::async(
        std::launch::async,
        [&gateway]()
        {
            gateway.Execute(
                {lila::modules::rooms::domain::RoomCommand::TogglePrivacy}, {});
        });
    const auto privacyCommand = nlohmann::json::parse(socket.WaitForSentPayload(3));
    const auto announcement = gateway.ReceiveEvent({});
    Expect(
        announcement.type == lila::modules::rooms::domain::RoomEventType::Announcement,
        "Annonce de table attendue");
    socket.QueueResponse(nlohmann::json{
        {"type", "room.ack"},
        {"payload", {
            {"action", "room.toggle-privacy"},
            {"traceId", privacyCommand.at("payload").at("_trace").at("id")}}},
    }.dump());
    Expect(
        gateway.ReceiveEvent({}).type == lila::modules::rooms::domain::RoomEventType::Ignored,
        "Accuse de confidentialite ignore attendu");
    privacyFuture.get();
    socket.QueueResponse(privacyPayload);
    const auto privacy = gateway.ReceiveEvent({});
    Expect(
        privacy.type == lila::modules::rooms::domain::RoomEventType::PrivacyChanged && privacy.value,
        "Table privee attendue");
    Expect(
        privacy.message.empty(),
        "Le changement de confidentialite doit rester silencieux; l'annonce est un evenement distinct.");

    socket.responses.push_back(nlohmann::json{
        {"type", "room.info"},
        {"payload", {{"message", "Table privee, 1 joueur."}}},
    }.dump());
    gateway.Execute({lila::modules::rooms::domain::RoomCommand::Info}, {});
    const auto info = gateway.ReceiveEvent({});
    Expect(
        info.type == lila::modules::rooms::domain::RoomEventType::Info &&
            info.message == "Table privee, 1 joueur.",
        "Informations de table attendues");

    socket.responses.push_back(nlohmann::json{
        {"type", "room.chat.message"},
        {"payload", {{"userId", 7}, {"username", "alice"}, {"message", "Bonjour"}}},
    }.dump());
    const auto chat = gateway.ReceiveEvent({});
    Expect(
        chat.type == lila::modules::rooms::domain::RoomEventType::ChatMessage &&
            chat.chatMessages.size() == 1 && chat.chatMessages.front().username == "alice" &&
            chat.chatMessages.front().message == "Bonjour",
        "Message de chat type attendu");

    socket.responses.push_back(nlohmann::json{
        {"type", "bot.added"},
        {"payload", {{"roomId", 42}, {"bot", {{"id", 9}, {"name", "Spirit"}}}}},
    }.dump());
    const auto botAdded = gateway.ReceiveEvent({});
    Expect(
        botAdded.type == lila::modules::rooms::domain::RoomEventType::BotAdded &&
            botAdded.member.has_value() && botAdded.member->id == 9 &&
            botAdded.member->name == "Spirit",
        "Ajout de bot temps reel type attendu");

    socket.responses.push_back(nlohmann::json{
        {"type", "bot.removed"},
        {"payload", {
            {"roomId", 42}, {"botId", 9},
            {"bot", {{"id", 9}, {"name", "Spirit"}}}}},
    }.dump());
    const auto botRemoved = gateway.ReceiveEvent({});
    Expect(
        botRemoved.type == lila::modules::rooms::domain::RoomEventType::BotRemoved &&
            botRemoved.member.has_value() && botRemoved.member->id == 9,
        "Retrait de bot temps reel type attendu");

    socket.responses.push_back(nlohmann::json{
        {"type", "room.deleted"},
        {"roomId", 42},
    }.dump());
    Expect(
        gateway.ReceiveEvent({}).type == lila::modules::rooms::domain::RoomEventType::Closed,
        "Fermeture de table typee attendue");

    std::cout << "[TEST PASSED] RoomSessionGatewayUsesWpfHandshakeContract\n";
}

