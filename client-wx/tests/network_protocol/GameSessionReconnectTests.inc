namespace
{
class ReconnectingGameSessionGateway final
    : public lila::modules::gameplay::application::IGameSessionGateway
{
public:
    [[nodiscard]] lila::modules::gameplay::domain::GameState Join(
        int roomId,
        std::string_view gameType,
        std::stop_token) override
    {
        std::scoped_lock lock(mutex);
        state.roomId = roomId;
        state.gameType = gameType;
        state.version = 1;
        interrupted = false;
        return state;
    }

    [[nodiscard]] lila::modules::gameplay::domain::GameState Reconnect(
        std::stop_token) override
    {
        std::scoped_lock lock(mutex);
        ++reconnectCount;
        interrupted = false;
        state.version = 2;
        return state;
    }

    void RequestState(std::stop_token) override {}
    void RequestRules(std::stop_token) override {}
    void SendKey(std::string_view, std::stop_token) override {}
    void ExecuteAction(
        const lila::modules::gameplay::domain::GameCommandEnvelope&,
        std::stop_token) override {}
    void RequestActionCandidates(
        const lila::modules::gameplay::domain::GameActionCandidatesRequest&,
        std::stop_token) override {}

    [[nodiscard]] lila::modules::gameplay::domain::GameEvent ReceiveEvent(
        std::stop_token stopToken) override
    {
        std::unique_lock lock(mutex);
        if (!failedOnce)
        {
            failedOnce = true;
            throw std::runtime_error("socket lost");
        }
        std::stop_callback cancelWait(stopToken, [this]() { condition.notify_all(); });
        condition.wait(lock, [this, stopToken]()
        {
            return interrupted || stopToken.stop_requested();
        });
        throw std::runtime_error("receive interrupted");
    }

    void Interrupt() override
    {
        {
            std::scoped_lock lock(mutex);
            interrupted = true;
        }
        condition.notify_all();
    }

    void Close() override { Interrupt(); }

    std::mutex mutex;
    std::condition_variable condition;
    lila::modules::gameplay::domain::GameState state;
    int reconnectCount = 0;
    bool failedOnce = false;
    bool interrupted = false;
};

void TestGameSessionServiceReconnectsAndRepublishesState()
{
    ReconnectingGameSessionGateway gateway;
    lila::modules::gameplay::application::GameSessionService service(gateway);
    std::mutex eventsMutex;
    std::vector<lila::modules::gameplay::domain::GameEvent> events;
    service.SetEventHandler([&eventsMutex, &events](auto event)
    {
        std::scoped_lock lock(eventsMutex);
        events.push_back(std::move(event));
    });

    const auto initialState = service.Join(42, "basket-express", {});
    Expect(initialState.version == 1, "Etat initial du jeu attendu");
    service.Start();

    WaitUntil(
        [&gateway, &eventsMutex, &events]()
        {
            {
                std::scoped_lock lock(gateway.mutex);
                if (gateway.reconnectCount == 0) return false;
            }
            std::scoped_lock lock(eventsMutex);
            return std::any_of(events.begin(), events.end(), [](const auto& event)
            {
                return event.type
                        == lila::modules::gameplay::domain::GameEventType::StateUpdated
                    && event.state.has_value()
                    && event.state->version == 2;
            });
        },
        "Le jeu devait se reconnecter et republier son etat",
        4'000);

    {
        std::scoped_lock lock(eventsMutex);
        const auto statusCount = std::count_if(events.begin(), events.end(), [](const auto& event)
        {
            return event.type
                == lila::modules::gameplay::domain::GameEventType::ConnectionStatus;
        });
        Expect(statusCount == 2, "Les statuts de reconnexion du jeu etaient attendus");
    }

    service.Close();
    std::cout << "[TEST PASSED] GameSessionServiceReconnectsAndRepublishesState\n";
}
}
