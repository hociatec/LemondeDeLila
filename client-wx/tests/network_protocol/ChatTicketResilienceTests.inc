namespace
{
void TestChatServiceKeepsSessionOnTransientTicketFailure()
{
    ChatServiceFixture fixture;
    fixture.gateway.ticketFailureStatuses = {0, 429, 0};
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
        "Nouvelle tentative apres refus temporaire attendue");
    WaitUntil(
        [&fixture]()
        {
            return fixture.service.State() ==
                lila::modules::chat::domain::ChatState::Connected;
        },
        "Etat reconnecte attendu");
    Expect(
        fixture.sessionStore.HasActiveSession(),
        "Un refus temporaire du ticket ne devait pas fermer la session");

    std::cout << "[TEST PASSED] ChatServiceKeepsSessionOnTransientTicketFailure\n";
}
}
