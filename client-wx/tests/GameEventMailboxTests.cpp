#include <cassert>
#include <cstddef>

#include "modules/gameplay/events/application/GameEventMailbox.h"

namespace
{
using lila::modules::gameplay::application::GameEventMailbox;
using lila::modules::gameplay::domain::GameEvent;
using lila::modules::gameplay::domain::GameEventType;

GameEvent Event(GameEventType type)
{
    GameEvent event;
    event.type = type;
    return event;
}
}

int main()
{
    GameEventMailbox mailbox(8);
    const auto session = mailbox.BeginSession();
    for (int version = 1; version <= 1'000; ++version)
    {
        auto event = Event(GameEventType::StateUpdated);
        event.state.emplace();
        event.state->version = version;
        const auto result = mailbox.Enqueue(std::move(event), session);
        assert(result.accepted);
        assert(result.shouldSchedule == (version == 1));
        assert(mailbox.Pending() <= 8);
    }
    auto stateBatch = mailbox.Drain(session);
    assert(stateBatch.events.size() == 1);
    assert(stateBatch.events.front().state->version == 1'000);
    assert(stateBatch.resyncRequired);
    assert(mailbox.Dropped(GameEventType::StateUpdated) == 999);

    // Critical events have their own queue: neither saturation nor a snapshot
    // storm may evict acknowledgements/errors needed to unlock input.
    for (int index = 0; index < 8; ++index)
        static_cast<void>(mailbox.Enqueue(Event(GameEventType::Ignored), session));
    static_cast<void>(mailbox.Enqueue(Event(GameEventType::Acknowledged), session));
    static_cast<void>(mailbox.Enqueue(Event(GameEventType::Error), session));
    static_cast<void>(mailbox.Enqueue(Event(GameEventType::Acknowledged), session));
    assert(mailbox.Pending() == 11);
    const auto priority = mailbox.Drain(session, 3);
    assert(priority.events.size() == 3);
    assert(priority.events[0].type == GameEventType::Acknowledged);
    assert(priority.events[1].type == GameEventType::Error);
    assert(priority.events[2].type == GameEventType::Acknowledged);
    assert(mailbox.Dropped(GameEventType::Acknowledged) == 0);
    assert(mailbox.Dropped(GameEventType::Error) == 0);

    mailbox.Clear();
    const auto replacementSession = mailbox.BeginSession();
    assert(!mailbox.Enqueue(Event(GameEventType::Error), session).accepted);
    assert(mailbox.Drain(session).events.empty());
    assert(mailbox.Enqueue(Event(GameEventType::ConnectionStatus), replacementSession).accepted);
    for (int index = 0; index < 100; ++index)
        static_cast<void>(mailbox.Enqueue(
            Event(index % 2 == 0 ? GameEventType::TurnUpdated
                                 : GameEventType::ConnectionStatus),
            replacementSession));
    static_cast<void>(mailbox.Enqueue(Event(GameEventType::Acknowledged), replacementSession));
    const auto reconnectStorm = mailbox.Drain(replacementSession, 32);
    assert(!reconnectStorm.events.empty());
    assert(reconnectStorm.events.front().type == GameEventType::Acknowledged);
    assert(mailbox.Dropped(GameEventType::TurnUpdated) > 0);
    assert(mailbox.Dropped(GameEventType::ConnectionStatus) > 0);
}
