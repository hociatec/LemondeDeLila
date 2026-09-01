class FakeRoomSessionGateway final : public lila::modules::rooms::application::IRoomSessionGateway
{
public:
    FakeRoomSessionGateway()
    {
        room.id = 42;
        room.name = "Table d'Alice";
        room.gameType = "four-winds";
        room.gameName = "Les quatre vents";
        room.status = "started";
        room.minPlayers = 2;
        room.maxPlayers = 4;
    }

    [[nodiscard]] lila::modules::rooms::domain::RoomState Create(
        std::string_view,
        std::stop_token stopToken) override
    {
        std::unique_lock lock(mutex);
        ++createCount;
        createEntered = true;
        active = true;
        interrupted = false;
        condition.notify_all();
        condition.wait(lock, [this, stopToken]()
        {
            return !blockCreate || stopToken.stop_requested();
        });
        if (stopToken.stop_requested()) throw std::runtime_error("create cancelled");
        return room;
    }

    [[nodiscard]] lila::modules::rooms::domain::RoomState Join(
        int,
        bool,
        std::stop_token) override
    {
        {
            std::scoped_lock lock(mutex);
            ++joinCount;
        }
        Activate();
        return room;
    }

    [[nodiscard]] lila::modules::rooms::domain::RoomState Reconnect(std::stop_token) override
    {
        {
            std::scoped_lock lock(mutex);
            ++reconnectCount;
            active = true;
            interrupted = false;
        }
        condition.notify_all();
        return room;
    }

    void Execute(
        const lila::modules::rooms::domain::RoomCommandRequest& request,
        std::stop_token) override
    {
        if (request.command == lila::modules::rooms::domain::RoomCommand::Ping)
        {
            std::scoped_lock lock(mutex);
            ++pingCount;
        }
    }

    [[nodiscard]] lila::modules::rooms::domain::RoomEvent ReceiveEvent(std::stop_token stopToken) override
    {
        std::unique_lock lock(mutex);
        condition.wait(lock, [this, stopToken]()
        {
            return stopToken.stop_requested() || interrupted || !events.empty();
        });
        if (stopToken.stop_requested()) return {};
        if (interrupted)
        {
            interrupted = false;
            throw std::runtime_error("socket lost");
        }
        auto event = std::move(events.front());
        events.pop_front();
        return event;
    }

    void Interrupt() override
    {
        {
            std::scoped_lock lock(mutex);
            interrupted = true;
        }
        condition.notify_all();
    }

    void Leave() override { Close(); }

    void Close() override
    {
        {
            std::scoped_lock lock(mutex);
            active = false;
            interrupted = true;
        }
        condition.notify_all();
    }

    void TriggerReceiveFailure() { Interrupt(); }

    void ReleaseCreate()
    {
        {
            std::scoped_lock lock(mutex);
            blockCreate = false;
        }
        condition.notify_all();
    }

    void Activate()
    {
        std::scoped_lock lock(mutex);
        active = true;
        interrupted = false;
    }

    lila::modules::rooms::domain::RoomState room;
    std::mutex mutex;
    std::condition_variable condition;
    std::deque<lila::modules::rooms::domain::RoomEvent> events;
    int reconnectCount = 0;
    int pingCount = 0;
    int createCount = 0;
    int joinCount = 0;
    bool active = false;
    bool interrupted = false;
    bool blockCreate = false;
    bool createEntered = false;
};
