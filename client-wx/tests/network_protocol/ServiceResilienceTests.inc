namespace
{
class ImmediateHttpSessionRefresher final
    : public lila::modules::session::application::ISessionRefresher
{
public:
    [[nodiscard]] lila::modules::session::application::SessionRefreshResult Refresh(
        const std::string&,
        std::stop_token = {}) override
    {
        ++count;
        lila::modules::session::application::SessionRefreshResult result;
        result.success = true;
        result.token = "new.header.signature";
        result.refreshToken = "new-refresh-token";
        result.expiresAt = 4102444800LL;
        return result;
    }

    [[nodiscard]] bool Revoke(const std::string&, std::stop_token = {}) override
    {
        return true;
    }

    int count = 0;
};

void TestAuthenticatedHttpClientRefreshesExpiredToken()
{
    auto refresher = std::make_unique<ImmediateHttpSessionRefresher>();
    auto* probe = refresher.get();
    lila::modules::session::application::SessionStore store(
        std::make_unique<InMemorySessionRepository>(), std::move(refresher));
    lila::modules::session::domain::Session session;
    session.userId = lila::shared::domain::UserId{42};
    session.username = "alice";
    session.token = "old.header.signature";
    session.refreshToken = "old-refresh-token";
    session.expiresAt = 4102444800LL;
    store.Open(std::move(session), false);

    struct Response { unsigned long statusCode; };
    std::vector<std::string> tokens;
    const auto response = lila::modules::session::application::SendHttpWithSessionRefresh(
        store, {}, true, [&tokens](const std::string& token)
        {
            tokens.push_back(token);
            return Response{tokens.size() == 1 ? 401UL : 200UL};
        });
    Expect(response.statusCode == 200 && tokens == std::vector<std::string>{
            "old.header.signature", "new.header.signature"} && probe->count == 1,
        "An authenticated HTTP 401 must refresh once and retry with the rotated token.");
}

void TestConcurrentSessionRefreshIsSingleFlight()
{
    auto refresher = std::make_unique<BlockingSessionRefresher>();
    auto* probe = refresher.get();
    lila::modules::session::application::SessionStore store(
        std::make_unique<InMemorySessionRepository>(), std::move(refresher));
    lila::modules::session::domain::Session session;
    session.userId = lila::shared::domain::UserId{42};
    session.username = "alice";
    session.token = "old.header.signature";
    session.refreshToken = "refresh-token";
    session.expiresAt = 1;
    store.Open(std::move(session), false);

    auto first = std::async(std::launch::async, [&] { return store.RefreshAccessToken(); });
    probe->WaitUntilStarted();
    auto second = std::async(std::launch::async, [&] { return store.RefreshAccessToken(); });
    WaitUntil([&] { return store.RefreshStats().waitingCallers == 1; },
        "The second refresh caller did not join the single-flight wait.");
    probe->Release();
    Expect(first.get() == "new-header.new-payload.new-signature" &&
            second.get() == "new-header.new-payload.new-signature",
        "Concurrent refresh callers must receive the same rotated token.");
    Expect(probe->RefreshCount() == 1,
        "Concurrent refresh callers must trigger exactly one server refresh.");
}

void TestConcurrentRejectedRefreshExpiresOnce()
{
    auto refresher = std::make_unique<BlockingRejectingSessionRefresher>();
    auto* probe = refresher.get();
    lila::modules::session::application::SessionStore store(
        std::make_unique<InMemorySessionRepository>(), std::move(refresher));
    lila::modules::session::domain::Session session;
    session.userId = lila::shared::domain::UserId{42};
    session.username = "alice";
    session.refreshToken = "expired-refresh-token";
    store.Open(std::move(session), false);
    std::atomic_int expiredCount{0};
    store.SetSessionExpiredHandler([&] { ++expiredCount; });

    auto refresh = [&store]
    {
        try { static_cast<void>(store.RefreshAccessToken()); }
        catch (const std::exception&) { return true; }
        return false;
    };
    auto first = std::async(std::launch::async, refresh);
    probe->WaitUntilStarted();
    auto second = std::async(std::launch::async, refresh);
    WaitUntil([&] { return store.RefreshStats().waitingCallers == 1; },
        "The second rejected refresh caller did not join the single-flight wait.");
    probe->Release();
    Expect(first.get() && second.get(), "Every waiter must observe the rejected refresh.");
    Expect(probe->RefreshCount() == 1 && expiredCount.load() == 1,
        "A rejected concurrent refresh must expire the session exactly once.");
    Expect(!store.HasActiveSession(), "The rejected session must be cleared.");
}

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
    fixture.gateway.openFailures = {false, true, false, true, true, false};
    fixture.gateway.receiveSteps.push_back({false, "history"});
    fixture.gateway.receiveSteps.push_back({true, "socket lost 1"});
    fixture.gateway.receiveSteps.push_back({false, "history-2"});
    fixture.gateway.receiveSteps.push_back({true, "socket lost 2"});
    fixture.gateway.receiveSteps.push_back({false, "history"});
    Expect(fixture.service.Open(), "Ouverture chat attendue");

    WaitUntil(
        [&fixture]()
        {
            std::lock_guard lock(fixture.gateway.mutex_);
            return fixture.gateway.openCount >= 6;
        },
        "Les pertes réseau répétées doivent toutes être suivies d'une reconnexion");
    WaitUntil(
        [&fixture]()
        {
            return fixture.service.State() == lila::modules::chat::domain::ChatState::Connected;
        },
        "Etat reconnecte attendu");

    std::cout << "[TEST PASSED] ChatServiceReconnectsAfterTransientFailure\n";
}

void TestChatServiceRecoversAfterStartupOutage()
{
    ChatServiceFixture fixture;
    fixture.gateway.openFailures = {true, false};
    fixture.gateway.receiveSteps.push_back({false, "history"});

    Expect(!fixture.service.Open(),
        "Un backend indisponible au démarrage doit échouer proprement.");
    Expect(fixture.service.State() == lila::modules::chat::domain::ChatState::Error &&
            fixture.sessionStore.HasActiveSession(),
        "Une panne de transport au démarrage ne doit pas supprimer la session.");
    Expect(fixture.service.Open(),
        "Le service doit pouvoir être rouvert lorsque le backend revient.");
    WaitUntil([&fixture]() { return !fixture.service.Messages().empty(); },
        "Le retour du backend doit restaurer les données initiales.");

    std::cout << "[TEST PASSED] ChatServiceRecoversAfterStartupOutage\n";
}

void TestChatServiceOpenIsIdempotent()
{
    ChatServiceFixture fixture;
    fixture.gateway.receiveSteps.push_back({false, "history"});
    Expect(fixture.service.Open(), "Ouverture chat attendue");
    WaitUntil(
        [&fixture]() { return !fixture.service.Messages().empty(); },
        "Historique initial attendu");

    Expect(fixture.service.Open(), "Réouverture idempotente attendue");
    {
        std::lock_guard lock(fixture.gateway.mutex_);
        Expect(fixture.gateway.openCount == 1, "La connexion existante devait être réutilisée");
    }
    Expect(!fixture.service.Messages().empty(), "L'historique devait être conservé");

    std::cout << "[TEST PASSED] ChatServiceOpenIsIdempotent\n";
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
