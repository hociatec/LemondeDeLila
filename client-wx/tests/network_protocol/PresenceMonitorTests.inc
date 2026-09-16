class PresenceSocket final : public lila::shared::network::websocket::IWebSocketClient
{
public:
    using Headers = lila::shared::network::websocket::WebSocketHeaders;
    void Connect(const std::string&, const Headers&, std::stop_token token) override
    {
        std::scoped_lock lock(mutex);
        if (token.stop_requested()) throw std::runtime_error("cancelled");
        connected = true;
        ++connections;
    }
    void Close() override { { std::scoped_lock lock(mutex); connected = false; } wake.notify_all(); }
    void CancelPendingOperation() noexcept override { Close(); }
    bool IsConnected() const override { std::scoped_lock lock(mutex); return connected; }
    bool IsConnectedTo(const std::string&, const Headers&) const override { return IsConnected(); }
    void Send(const std::string& data) override
    {
        std::scoped_lock lock(mutex);
        if (!connected) throw std::runtime_error("closed");
        sent.push_back(data);
    }
    std::string Receive() override
    {
        std::unique_lock lock(mutex);
        wake.wait(lock, [&] { return !connected || !incoming.empty(); });
        if (!connected) throw std::runtime_error("closed");
        auto result = incoming.front(); incoming.pop_front(); return result;
    }
    std::string SendAndReceive(const std::string&, const std::string&, const Headers&, std::stop_token) override
    { throw std::runtime_error("unused"); }
    void Push(std::string data)
    { { std::scoped_lock lock(mutex); incoming.push_back(std::move(data)); } wake.notify_all(); }
    std::size_t Count() const { std::scoped_lock lock(mutex); return sent.size(); }
    bool Sent(const std::string& text) const
    {
        std::scoped_lock lock(mutex);
        return std::ranges::any_of(sent, [&](const auto& message) { return message.find(text) != std::string::npos; });
    }
    int Connections() const { std::scoped_lock lock(mutex); return connections; }
private:
    mutable std::mutex mutex;
    std::condition_variable wake;
    bool connected = false;
    int connections = 0;
    std::vector<std::string> sent;
    std::deque<std::string> incoming;
};

class PresenceTickets final : public lila::shared::network::http::IWsTicketProvider
{
    std::string GetTicket(const std::string&, const std::string&) const override { return "test"; }
};

void TestPresenceActivityAndReconnect()
{
    lila::modules::session::application::SessionStore sessions(std::make_unique<InMemorySessionRepository>());
    lila::modules::session::domain::Session session;
    session.userId = lila::shared::domain::UserId{42};
    session.username = "alice"; session.token = "header.payload.signature"; session.expiresAt = 4102444800LL;
    sessions.Open(session, false);
    PresenceSocket socket;
    PresenceTickets tickets;
    FakeAudioService audio;
    lila::modules::presence::application::PresenceMonitor monitor("test", socket, tickets, sessions, audio, {});
    monitor.SetContext("messaging");
    monitor.Start();
    WaitUntil([&] { return socket.Sent("messaging"); }, "Presence must send the current screen");
    const auto before = socket.Count();
    std::this_thread::sleep_for(std::chrono::milliseconds(1100));
    Expect(socket.Count() == before, "Idle connection must not simulate user activity");
    monitor.ReportInteraction();
    WaitUntil([&] { return socket.Sent("presence-activity"); }, "Real interaction must be reported");
    monitor.SetContext("social");
    WaitUntil([&] { return socket.Sent("social"); }, "Screen changes must be reported");
    const std::string snapshot = R"({"type":"presence-update","players":[{"id":2,"username":"Bob","availability":"available"},{"id":1,"username":"Alice","availability":"absent"}]})";
    socket.Push(snapshot);
    WaitUntil([&] { return monitor.HasSnapshot(); }, "Presence snapshot expected");
    Expect(monitor.Players()[0].username == "Alice", "Presence ordering must not depend on availability");
    const auto sentBeforeReconnect = socket.Count();
    socket.Close();
    WaitUntil([&] { return socket.Connections() >= 2; }, "Presence must reconnect");
    WaitUntil([&] { return socket.Count() > sentBeforeReconnect; }, "Reconnect must restore context");
    monitor.Stop();
    Expect(!monitor.HasSnapshot(), "Stopping must clear presence");
    std::cout << "[TEST PASSED] PresenceActivityAndReconnect\n";
}
