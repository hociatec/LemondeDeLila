void TestSessionClearWipesRefreshToken()
{
    lila::modules::session::domain::Session session;
    session.token = "header.payload.signature";
    session.refreshToken = "refresh-token";
    session.ClearSecret();

    Expect(session.token.empty(), "Access token doit etre efface");
    Expect(session.refreshToken.empty(), "Refresh token doit etre efface");

    std::cout << "[TEST PASSED] SessionClearWipesRefreshToken\n";
}

void TestSessionMovePreservesSecrets()
{
    lila::modules::session::domain::Session session;
    session.userId = lila::shared::domain::UserId{42};
    session.username = "alice";
    session.token = "header.payload.signature";
    session.refreshToken = "refresh-token";
    session.expiresAt = 4102444800LL;

    lila::modules::session::domain::Session moved(std::move(session));

    Expect(moved.userId == lila::shared::domain::UserId{42}, "UserId deplace attendu");
    Expect(moved.username == "alice", "Username deplace attendu");
    Expect(moved.token == "header.payload.signature", "Token deplace attendu");
    Expect(moved.refreshToken == "refresh-token", "Refresh token deplace attendu");
    Expect(moved.expiresAt == 4102444800LL, "Expiration deplacee attendue");
    Expect(session.token.empty(), "Source deplacee: token doit etre efface");
    Expect(session.refreshToken.empty(), "Source deplacee: refresh token doit etre efface");

    std::cout << "[TEST PASSED] SessionMovePreservesSecrets\n";
}

void TestSessionStoreRestoreLoadsPersistedSession()
{
    auto repository = std::make_unique<InMemorySessionRepository>();

    lila::modules::session::domain::Session persisted;
    persisted.userId = lila::shared::domain::UserId{7};
    persisted.username = "restored-user";
    persisted.token = "header.payload.signature";
    persisted.refreshToken = "refresh-token";
    persisted.expiresAt = 4102444800LL;
    repository->Save(persisted);

    lila::modules::session::application::SessionStore sessionStore(std::move(repository));
    Expect(sessionStore.Restore(), "La restauration de session devait reussir");
    Expect(sessionStore.HasActiveSession(), "Une session active restauree etait attendue");
    Expect(sessionStore.Current().username == "restored-user", "Username restaure attendu");
    Expect(sessionStore.Current().token == "header.payload.signature", "Token restaure attendu");
    Expect(sessionStore.IsPersistent(), "La session restauree devait etre marquee persistante");

    std::cout << "[TEST PASSED] SessionStoreRestoreLoadsPersistedSession\n";
}

void TestSessionStoreRejectsSupersededConcurrentRefresh()
{
    auto refresher = std::make_unique<BlockingSessionRefresher>();
    auto* refresherProbe = refresher.get();
    lila::modules::session::application::SessionStore sessionStore(
        std::make_unique<InMemorySessionRepository>(),
        std::move(refresher));

    lila::modules::session::domain::Session firstSession;
    firstSession.userId = lila::shared::domain::UserId{1};
    firstSession.username = "first-user";
    firstSession.token = "old-header.old-payload.old-signature";
    firstSession.refreshToken = "old-refresh-token";
    firstSession.expiresAt = 1;
    sessionStore.Open(std::move(firstSession), false);

    auto refresh = std::async(
        std::launch::async,
        [&sessionStore]() { return sessionStore.RefreshAccessToken(); });
    refresherProbe->WaitUntilStarted();

    sessionStore.Clear();
    lila::modules::session::domain::Session secondSession;
    secondSession.userId = lila::shared::domain::UserId{2};
    secondSession.username = "second-user";
    secondSession.token = "second-header.second-payload.second-signature";
    secondSession.refreshToken = "second-refresh-token";
    secondSession.expiresAt = 4102444800LL;
    sessionStore.Open(std::move(secondSession), false);
    refresherProbe->Release();

    bool supersededRefreshRejected = false;
    try
    {
        static_cast<void>(refresh.get());
    }
    catch (const std::exception&)
    {
        supersededRefreshRejected = true;
    }

    Expect(supersededRefreshRejected, "Un refresh d'une ancienne session doit etre rejete");
    const auto snapshot = sessionStore.Current();
    Expect(snapshot.userId == lila::shared::domain::UserId{2}, "La nouvelle session doit rester active");
    Expect(snapshot.token == "second-header.second-payload.second-signature", "Le token du nouvel utilisateur doit rester intact");
    Expect(refresherProbe->WasRevoked("rotated-refresh-token"), "Le refresh token devenu orphelin doit etre revoque");

    auto modifiedSnapshot = sessionStore.Current();
    modifiedSnapshot.username = "mutated-copy";
    Expect(sessionStore.Current().username == "second-user", "Current doit retourner une copie protegee");

    std::cout << "[TEST PASSED] SessionStoreRejectsSupersededConcurrentRefresh\n";
}

void TestSessionStoreNotifiesRejectedRefresh()
{
    lila::modules::session::application::SessionStore sessionStore(
        std::make_unique<InMemorySessionRepository>(),
        std::make_unique<RejectingSessionRefresher>());
    lila::modules::session::domain::Session session;
    session.userId = lila::shared::domain::UserId{1};
    session.username = "expired-user";
    session.refreshToken = "expired-refresh-token";
    sessionStore.Open(std::move(session), true);

    int notificationCount = 0;
    sessionStore.SetSessionExpiredHandler([&notificationCount]() { ++notificationCount; });
    bool rejected = false;
    try
    {
        static_cast<void>(sessionStore.RefreshAccessToken());
    }
    catch (const std::exception&)
    {
        rejected = true;
    }

    Expect(rejected, "Le renouvellement refuse devait echouer");
    Expect(notificationCount == 1, "L'expiration de session devait etre notifiee une fois");
    Expect(!sessionStore.HasActiveSession(), "La session refusee devait etre effacee");

    std::cout << "[TEST PASSED] SessionStoreNotifiesRejectedRefresh\n";
}

void TestAtomicFileWriterReplacesExistingContent()
{
    const std::filesystem::path path = std::filesystem::current_path() / "atomic-write-test.txt";

    lila::shared::persistence::WriteTextAtomically(path, "first", "atomic write failed");
    lila::shared::persistence::WriteTextAtomically(path, "second", "atomic write failed");

    std::ifstream file(path, std::ios::binary);
    std::string content((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
    file.close();
    std::filesystem::remove(path);

    Expect(content == "second", "Ecriture atomique devait remplacer le contenu");

    std::cout << "[TEST PASSED] AtomicFileWriterReplacesExistingContent\n";
}

void TestEncodingRoundTripUnicode()
{
    const std::string utf8 = "Caf\xC3\xA9 d\xC3\xA9j\xC3\xA0 \xE2\x80\x94 \xE6\xBC\xA2\xE5\xAD\x97";
    const wxString wide = lila::shared::text::FromUtf8(utf8);
    const std::string roundTrip = lila::shared::text::ToUtf8(wide);
    const std::wstring wideDirect = lila::shared::text::Utf8ToWide(utf8);

    Expect(roundTrip == utf8, "Round-trip UTF-8 invalide");
    Expect(!wideDirect.empty(), "Conversion wide attendue non vide");

    std::cout << "[TEST PASSED] EncodingRoundTripUnicode\n";
}

void TestEncodingRejectsInvalidUtf8()
{
    const std::string invalid("\xC3\x28", 2);
    bool threw = false;
    try
    {
        static_cast<void>(lila::shared::text::FromUtf8(invalid));
    }
    catch (const std::runtime_error& error)
    {
        threw = true;
        Expect(std::string(error.what()) == lila::shared::errors::Utf8DecodeFailed, "Erreur UTF-8 attendue");
    }

    Expect(threw, "UTF-8 invalide devait echouer");

    std::cout << "[TEST PASSED] EncodingRejectsInvalidUtf8\n";
}

void TestBrokenAccentRepairCanBeToggled()
{
    const std::string broken = "cafÃ©";
    lila::shared::text::SetBrokenAccentRepairEnabled(false);
    Expect(lila::shared::text::FromUtf8(broken) == wxString(L"cafÃ©"), "Texte casse doit rester intact si option desactivee");

    lila::shared::text::SetBrokenAccentRepairEnabled(true);
    Expect(lila::shared::text::FromUtf8(broken) == wxString(L"café"), "Accent casse devait etre repare");

    std::cout << "[TEST PASSED] BrokenAccentRepairCanBeToggled\n";
}
