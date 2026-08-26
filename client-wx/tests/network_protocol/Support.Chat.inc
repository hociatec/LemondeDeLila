class FakeChatProtocol final : public lila::modules::chat::infrastructure::IChatProtocol
{
public:
    [[nodiscard]] std::string BuildSendPayload(const std::string& text) const override
    {
        return "send:" + text;
    }

    [[nodiscard]] std::string BuildEditPayload(const std::string& messageId, const std::string& text) const override
    {
        return "edit:" + messageId + ":" + text;
    }

    [[nodiscard]] std::string BuildDeletePayload(const std::string& messageId) const override
    {
        return "delete:" + messageId;
    }

    [[nodiscard]] lila::modules::chat::infrastructure::ChatEvent ParseEvent(
        const std::string& rawJson,
        int currentUserId,
        std::time_t nowUtc) const override
    {
        using namespace lila::modules::chat;

        infrastructure::ChatEvent event;
        if (rawJson == "history")
        {
            event.type = infrastructure::ChatEventType::History;
            event.editWindowSeconds = 30;

            domain::ChatMessage message;
            message.id = "m1";
            message.userId = currentUserId;
            message.user = "alice";
            message.text = "bonjour";
            message.timestampUtc = nowUtc;
            message.isMine = true;
            event.messages.push_back(std::move(message));
            return event;
        }

        if (rawJson == "history-2")
        {
            event.type = infrastructure::ChatEventType::History;
            event.editWindowSeconds = 15;

            domain::ChatMessage message;
            message.id = "m2";
            message.userId = currentUserId;
            message.user = "alice";
            message.text = "reconnecte";
            message.timestampUtc = nowUtc;
            message.isMine = true;
            event.messages.push_back(std::move(message));
            return event;
        }

        if (rawJson == "server-error")
        {
            event.type = infrastructure::ChatEventType::Error;
            event.error = domain::ChatServerError{"Erreur chat", "server", std::nullopt};
            return event;
        }

        event.type = infrastructure::ChatEventType::Ignored;
        return event;
    }
};

class FakeChatGateway final : public lila::modules::chat::application::IChatGateway
{
public:
    struct ReceiveStep
    {
        bool throws = false;
        std::string value;
    };

    void Open(const std::string&, const std::string&) override
    {
        std::lock_guard lock(mutex_);
        ++openCount;
        if (!openFailures.empty())
        {
            const bool shouldFail = openFailures.front();
            openFailures.pop_front();
            if (shouldFail)
            {
                throw std::runtime_error("open failed");
            }
        }
    }

    void Close() override
    {
        std::lock_guard lock(mutex_);
        ++closeCount;
    }

    void Interrupt() override
    {
        {
            std::lock_guard lock(mutex_);
            ++interruptCount;
            interrupted = true;
        }
        condition_.notify_all();
    }

    void Send(const std::string& payload) override
    {
        std::lock_guard lock(mutex_);
        ++sendCount;
        lastSentPayload = payload;
        if (sendShouldThrow)
        {
            throw std::runtime_error("send failed");
        }
    }

    [[nodiscard]] std::string Receive() override
    {
        std::unique_lock lock(mutex_);
        condition_.wait(lock, [this]() { return interrupted || !receiveSteps.empty(); });

        if (interrupted)
        {
            interrupted = false;
            throw std::runtime_error("interrupted");
        }

        const ReceiveStep step = receiveSteps.front();
        receiveSteps.pop_front();
        if (step.throws)
        {
            throw std::runtime_error(step.value);
        }

        return step.value;
    }

    std::mutex mutex_;
    std::condition_variable condition_;
    std::deque<ReceiveStep> receiveSteps;
    std::deque<bool> openFailures;
    int openCount = 0;
    int closeCount = 0;
    int interruptCount = 0;
    int sendCount = 0;
    bool sendShouldThrow = false;
    bool interrupted = false;
    std::string lastSentPayload;
};
}

