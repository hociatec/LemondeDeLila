#include <cassert>
#include <cstddef>

#include "modules/gameplay/events/application/GameEventMailbox.h"

int main()
{
    using namespace lila::modules::gameplay;
    application::GameEventMailbox mailbox(8);
    for (int version = 1; version <= 1'000; ++version)
    {
        domain::GameEvent event;
        event.type = domain::GameEventType::StateUpdated;
        event.state.emplace();
        event.state->version = version;
        const bool shouldSchedule = mailbox.Enqueue(std::move(event));
        assert(shouldSchedule == (version == 1));
        assert(mailbox.Pending() <= 8);
    }
    auto stateBatch = mailbox.Drain();
    assert(stateBatch.events.size() == 1);
    assert(stateBatch.events.front().state->version == 1'000);
    assert(mailbox.Dropped() == 999);

    for (int index = 0; index < 32; ++index)
    {
        domain::GameEvent event;
        event.type = domain::GameEventType::Acknowledged;
        static_cast<void>(mailbox.Enqueue(std::move(event)));
    }
    assert(mailbox.Pending() == 8);
    assert(mailbox.Dropped() == 1'023);
    const auto first = mailbox.Drain(3);
    assert(first.events.size() == 3 && first.morePending);
    const auto second = mailbox.Drain(32);
    assert(second.events.size() == 5 && !second.morePending);
}
