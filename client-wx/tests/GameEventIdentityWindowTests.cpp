#include <cassert>
#include <string>

#include "modules/gameplay/events/application/GameEventIdentityWindow.h"

int main()
{
    lila::modules::gameplay::application::GameEventIdentityWindow events(3);
    assert(events.Observe("a"));
    assert(!events.Observe("a"));
    assert(events.Observe("b"));
    assert(events.Observe("c"));
    assert(events.Observe("d"));
    assert(events.Size() == 3);
    assert(!events.Contains("a"));
    assert(events.Contains("d"));
    events.Reset();
    assert(events.Size() == 0);
}
