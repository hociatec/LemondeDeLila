void TestNotificationMonitorReconnect()
{
    lila::modules::session::application::SessionStore sessions(std::make_unique<InMemorySessionRepository>());
    lila::modules::session::domain::Session session;
    session.userId = lila::shared::domain::UserId{42};
    session.username = "alice"; session.token = "header.payload.signature"; session.expiresAt = 4102444800LL;
    sessions.Open(session, false);
    PresenceSocket socket;
    PresenceTickets tickets;
    lila::modules::rooms::application::RoomInvitationMonitor monitor("test", socket, tickets, sessions);
    std::atomic_int notifications{0}, invitations{0};
    monitor.SetMessageHandler([&](const auto&) { ++notifications; });
    monitor.SetInvitationHandler([&](auto) { ++invitations; });
    monitor.Start();
    WaitUntil([&] { return socket.Connections() == 1; }, "Notify connection expected");
    socket.Push(R"({"type":"messaging.message","payload":{"messageId":1}})");
    WaitUntil([&] { return notifications.load() == 1; }, "Non-room notification must reach handler");
    socket.Close();
    WaitUntil([&] { return socket.Connections() >= 2; }, "Notification monitor must reconnect");
    socket.Push(R"({"type":"room.lobby.invite.received","payload":{"invitationId":"i","room":{"id":1},"from":{"id":8}}})");
    WaitUntil([&] { return invitations.load() == 1; }, "Room invitations must still work after reconnect");
    monitor.Stop();
    Expect(!socket.IsConnected(), "Monitor stop must close and join its worker");
    monitor.Start();
    WaitUntil([&] { return socket.Connections() >= 3; }, "Monitor must restart after logout/login");
    monitor.Stop();
}
