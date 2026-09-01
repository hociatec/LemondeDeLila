namespace
{
void TestEnsureSuccessOrThrowClearsExpiredSession()
{
    lila::modules::session::application::SessionStore sessionStore(std::make_unique<InMemorySessionRepository>());
    lila::modules::session::domain::Session session;
    session.userId = lila::shared::domain::UserId{42};
    session.username = "alice";
    session.token = "header.payload.signature";
    session.expiresAt = 4102444800LL;
    sessionStore.Open(session, false);

    lila::shared::network::realtime::RealtimeApiResponse response;
    response.success = false;
    response.statusCode = 401;
    response.errorMessage = "expired";

    bool threw = false;
    try
    {
        lila::shared::network::realtime::helpers::EnsureSuccessOrThrow(response, sessionStore, "fallback");
    }
    catch (const std::runtime_error& error)
    {
        threw = true;
        Expect(std::string(error.what()) == lila::shared::errors::SessionExpiredMessage, "SessionExpired attendu");
    }

    Expect(threw, "Session expiree devait lever une exception");
    Expect(!sessionStore.HasActiveSession(), "La session devait etre videe");

    lila::shared::network::realtime::RealtimeApiResponse rejected;
    rejected.success = false;
    rejected.errorKind = lila::shared::network::realtime::RealtimeErrorKind::Server;
    rejected.errorMessage = "Vous devez lancer le jeu avant de pouvoir sauvegarder.";
    bool serverMessagePreserved = false;
    try
    {
        lila::shared::network::realtime::helpers::EnsureSuccessOrThrow(
            rejected, sessionStore, "Operation impossible dans le coffre fort.");
    }
    catch (const lila::shared::errors::AppException& error)
    {
        serverMessagePreserved = error.Error().UserMessage() == rejected.errorMessage;
    }
    Expect(serverMessagePreserved, "Le motif du refus serveur devait etre affiche");

    std::cout << "[TEST PASSED] EnsureSuccessOrThrowClearsExpiredSession\n";
}

class InstalledBackgroundExecutor final
{
public:
    explicit InstalledBackgroundExecutor(std::size_t workerCount)
        : executor_({.workerCount = workerCount, .queueCapacity = 16})
    {
        lila::shared::concurrency::InstallBackgroundExecutor(executor_);
    }

    ~InstalledBackgroundExecutor()
    {
        executor_.Shutdown();
        lila::shared::concurrency::UninstallBackgroundExecutor();
    }

private:
    lila::shared::concurrency::BackgroundExecutor executor_;
};

class ChatServiceFixture final
{
public:
    ChatServiceFixture()
        : sessionStore(std::make_unique<InMemorySessionRepository>()),
          optionsStore(std::make_unique<InMemoryOptionsRepository>()),
          service(gateway, protocol, sessionStore, optionsStore, audioService)
    {
        optionsStore.Load();
        lila::modules::session::domain::Session session;
        session.userId = lila::shared::domain::UserId{7};
        session.username = "alice";
        session.token = "header.payload.signature";
        session.expiresAt = 4102444800LL;
        sessionStore.Open(std::move(session), false);
    }

    ~ChatServiceFixture() { service.Close(); }

    InstalledBackgroundExecutor backgroundExecutor{1};
    FakeChatGateway gateway;
    FakeChatProtocol protocol;
    lila::modules::session::application::SessionStore sessionStore;
    lila::modules::options::application::OptionsStore optionsStore;
    FakeAudioService audioService;
    lila::modules::chat::application::ChatService service;
};

void TestChatServiceCloseInterruptsReceiveLoop()
{
    ChatServiceFixture fixture;
    fixture.gateway.receiveSteps.push_back({false, "history"});
    Expect(fixture.service.Open(), "Ouverture chat attendue");
    WaitUntil(
        [&fixture]() { return !fixture.service.Messages().empty(); },
        "Historique initial attendu");

    fixture.service.Close();
    Expect(fixture.service.State() == lila::modules::chat::domain::ChatState::Disconnected,
        "Etat deconnexion attendu");
    Expect(fixture.gateway.interruptCount >= 1, "Interrupt attendu");

    std::cout << "[TEST PASSED] ChatServiceCloseInterruptsReceiveLoop\n";
}

void TestChatServiceReconnectsAfterTransientFailure()
{
    ChatServiceFixture fixture;
    fixture.gateway.openFailures = {false, true, false};
    fixture.gateway.receiveSteps.push_back({false, "history"});
    fixture.gateway.receiveSteps.push_back({true, "socket lost"});
    fixture.gateway.receiveSteps.push_back({false, "history-2"});
    Expect(fixture.service.Open(), "Ouverture chat attendue");

    WaitUntil(
        [&fixture]()
        {
            std::lock_guard lock(fixture.gateway.mutex_);
            return fixture.gateway.openCount >= 3;
        },
        "Reconnexions attendues");
    WaitUntil(
        [&fixture]()
        {
            return fixture.service.State() == lila::modules::chat::domain::ChatState::Connected;
        },
        "Etat reconnecte attendu");

    std::cout << "[TEST PASSED] ChatServiceReconnectsAfterTransientFailure\n";
}

void TestChatServiceSendReportsTransportFailure()
{
    ChatServiceFixture fixture;
    fixture.gateway.openFailures = {false};
    fixture.gateway.receiveSteps.push_back({false, "history"});
    fixture.gateway.sendShouldThrow = true;
    Expect(fixture.service.Open(), "Ouverture chat attendue");

    bool threw = false;
    try
    {
        fixture.service.Send("salut");
    }
    catch (const std::runtime_error& error)
    {
        threw = true;
        Expect(std::string(error.what()).find(lila::shared::errors::ChatSendFailed) != std::string::npos, "Erreur d'envoi attendue");
    }

    Expect(threw, "Envoi en echec devait lever");

    std::cout << "[TEST PASSED] ChatServiceSendReportsTransportFailure\n";
}

void TestRoomSessionServiceReconnectsAndRepublishesState()
{
    InstalledBackgroundExecutor backgroundExecutor(3);

    FakeRoomSessionGateway gateway;
    lila::modules::rooms::application::RoomSessionService service(gateway);
    std::mutex eventsMutex;
    std::vector<lila::modules::rooms::domain::RoomEvent> receivedEvents;
    service.SetEventHandler(
        [&eventsMutex, &receivedEvents](lila::modules::rooms::domain::RoomEvent event)
        {
            std::scoped_lock lock(eventsMutex);
            receivedEvents.push_back(std::move(event));
        });

    const auto initial = service.Join(42, false, {});
    Expect(initial.id == 42, "Etat initial de table attendu");
    service.Start();
    gateway.TriggerReceiveFailure();

    WaitUntil(
        [&gateway]()
        {
            std::scoped_lock lock(gateway.mutex);
            return gateway.reconnectCount >= 1;
        },
        "Reconnexion de table attendue");
    WaitUntil(
        [&eventsMutex, &receivedEvents]()
        {
            std::scoped_lock lock(eventsMutex);
            return std::any_of(
                receivedEvents.begin(),
                receivedEvents.end(),
                [](const auto& event)
                {
                    return event.type == lila::modules::rooms::domain::RoomEventType::StateUpdated &&
                        event.room.has_value() && event.room->id == 42;
                });
        },
        "Etat de table republie apres reconnexion attendu");

    service.Close();
    std::cout << "[TEST PASSED] RoomSessionServiceReconnectsAndRepublishesState\n";
}

}
