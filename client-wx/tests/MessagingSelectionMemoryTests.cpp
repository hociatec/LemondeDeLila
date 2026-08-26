#include <cassert>
#include <vector>

#include "modules/messaging/presentation/MessagingSelectionMemory.h"

using namespace lila::modules::messaging;

int main()
{
    presentation::MessagingSelectionMemory memory;
    std::vector<domain::MessagingMessage> messages(3);
    messages[0].id = lila::shared::domain::MessageId{"a"};
    messages[1].id = lila::shared::domain::MessageId{"b"};
    messages[2].id = lila::shared::domain::MessageId{"c"};

    assert(memory.ResolveIndex(domain::MessagingBox::Inbox, messages) == 0);
    memory.Store(domain::MessagingBox::Inbox, lila::shared::domain::MessageId{"b"});
    assert(memory.ResolveIndex(domain::MessagingBox::Inbox, messages) == 1);

    memory.Store(domain::MessagingBox::Inbox, lila::shared::domain::MessageId{"missing"});
    assert(memory.ResolveIndex(domain::MessagingBox::Inbox, messages) == 0);

    memory.Store(domain::MessagingBox::Outbox, lila::shared::domain::MessageId{"c"});
    assert(memory.ResolveIndex(domain::MessagingBox::Outbox, messages) == 2);
    assert(memory.ResolveIndex(domain::MessagingBox::Deleted, messages) == 0);

    std::vector<domain::MessagingMessage> empty;
    assert(!memory.ResolveIndex(domain::MessagingBox::Inbox, empty).has_value());

    assert(domain::MessagingBoxFromMenuIndex(1) == domain::MessagingBox::Inbox);
    assert(domain::MessagingBoxFromMenuIndex(2) == domain::MessagingBox::Outbox);
    assert(domain::MessagingBoxFromMenuIndex(3) == domain::MessagingBox::Deleted);
    assert(!domain::MessagingBoxFromMenuIndex(0).has_value());

    return 0;
}
