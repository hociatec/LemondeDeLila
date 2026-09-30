namespace
{
class ImmediateSessionRefresher final
    : public lila::modules::session::application::ISessionRefresher
{
public:
    [[nodiscard]] lila::modules::session::application::SessionRefreshResult Refresh(
        const std::string& refreshToken,
        std::stop_token = {}) override
    {
        Expect(refreshToken == "old-refresh-token", "Refresh token initial attendu");
        ++count;
        lila::modules::session::application::SessionRefreshResult result;
        result.success = true;
        result.token = "new-header.new-payload.new-signature";
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

void VerifyTicketRejectionRefreshesConnection(unsigned long statusCode)
{
    auto refresher = std::make_unique<ImmediateSessionRefresher>();
    auto* probe = refresher.get();
    lila::modules::session::application::SessionStore store(
        std::make_unique<InMemorySessionRepository>(), std::move(refresher));
    lila::modules::session::domain::Session session;
    session.userId = lila::shared::domain::UserId{42};
    session.username = "alice";
    session.token = "old-header.old-payload.old-signature";
    session.refreshToken = "old-refresh-token";
    session.expiresAt = 4102444800LL;
    store.Open(std::move(session), false);

    int disconnectCount = 0;
    std::vector<std::string> attemptedTokens;
    lila::modules::session::application::ConnectWithSessionRefresh(
        store,
        {},
        [&] { ++disconnectCount; },
        [&](const std::string& token)
        {
            attemptedTokens.push_back(token);
            if (attemptedTokens.size() == 1)
                throw lila::shared::network::http::WsTicketRequestError(
                    "ticket rejected", statusCode);
        });

    Expect(attemptedTokens == std::vector<std::string>({
            "old-header.old-payload.old-signature",
            "new-header.new-payload.new-signature"}),
        "La reconnexion doit utiliser le token renouvele");
    Expect(disconnectCount == 1, "L'ancienne connexion doit etre fermee une fois");
    Expect(probe->count == 1, "Le refus du ticket doit lancer un seul refresh");
}

void TestTicketRejectionRefreshesWebSocketConnection()
{
    VerifyTicketRejectionRefreshesConnection(401);
    VerifyTicketRejectionRefreshesConnection(403);
    std::cout << "[TEST PASSED] TicketRejectionRefreshesWebSocketConnection\n";
}
}
