class FakeRoomTicketProvider final : public lila::shared::network::http::IWsTicketProvider
{
public:
    [[nodiscard]] std::string GetTicket(
        const std::string& scope,
        const std::string& bearerToken) const override
    {
        requestedScope = scope;
        requestedBearerToken = bearerToken;
        return "room-ticket";
    }

    mutable std::string requestedScope;
    mutable std::string requestedBearerToken;
};

class FakeRoomWebSocketClient final : public lila::shared::network::websocket::IWebSocketClient
{
public:
    void Connect(
        const std::string& value,
        const lila::shared::network::websocket::WebSocketHeaders& valueHeaders,
        std::stop_token = {}) override
    {
        endpoint = value;
        headers = valueHeaders;
        connected = true;
    }

    void Close() override { connected = false; }
    void CancelPendingOperation() noexcept override { connected = false; }
    [[nodiscard]] bool IsConnected() const override { return connected; }
    [[nodiscard]] bool IsConnectedTo(
        const std::string& value,
        const lila::shared::network::websocket::WebSocketHeaders& valueHeaders) const override
    {
        return connected && endpoint == value && headers == valueHeaders;
    }
    void Send(const std::string& payload) override
    {
        {
            std::scoped_lock lock(ioMutex);
            sentPayloads.push_back(payload);
        }
        sentCondition.notify_all();
    }
    [[nodiscard]] std::string Receive() override
    {
        std::scoped_lock lock(ioMutex);
        if (responses.empty()) throw std::runtime_error("No fake room response.");
        auto response = std::move(responses.front());
        responses.pop_front();
        return response;
    }

    void QueueResponse(std::string response)
    {
        std::scoped_lock lock(ioMutex);
        responses.push_back(std::move(response));
    }

    [[nodiscard]] std::string WaitForSentPayload(std::size_t count)
    {
        std::unique_lock lock(ioMutex);
        if (!sentCondition.wait_for(
                lock,
                std::chrono::seconds(1),
                [this, count]() { return sentPayloads.size() >= count; }))
            throw std::runtime_error("Timed out waiting for fake room command.");
        return sentPayloads.at(count - 1);
    }
    [[nodiscard]] std::string SendAndReceive(
        const std::string&,
        const std::string&,
        const lila::shared::network::websocket::WebSocketHeaders&,
        std::stop_token) override
    {
        throw std::runtime_error("Unexpected SendAndReceive call.");
    }

    bool connected = false;
    std::string endpoint;
    lila::shared::network::websocket::WebSocketHeaders headers;
    std::vector<std::string> sentPayloads;
    std::deque<std::string> responses;
    std::mutex ioMutex;
    std::condition_variable sentCondition;
};

