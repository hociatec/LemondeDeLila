#include <cassert>
#include <vector>

#include "modules/social/presentation/SocialDataStore.h"
#include "modules/social/presentation/SocialDataStore.inl"

using namespace lila::modules::social;

int main()
{
    presentation::SocialDataStore store;

    domain::SocialUser alice{1, "alice", "", "2026-01-01"};
    domain::SocialUser bob{2, "bob", "", "2026-02-01"};
    domain::SocialUser blockedFriend{3, "charlie", "", "2026-03-01", "", "2026-04-01"};
    domain::SocialUser blockedOnly{4, "dora", "", "", "", "2026-04-02"};

    store.ReplaceAll(
        {alice, bob},
        {},
        {},
        {blockedFriend, blockedOnly});

    assert(store.Friends().size() == 3);
    assert(store.IsBlocked(3));
    assert(store.IsBlocked(4));
    assert(!store.IsBlocked(1));
    assert(store.UserIdAt(presentation::SocialSection::Friends, 0) == 1);
    assert(store.UserIdAt(presentation::SocialSection::Friends, 2) == 3);
    assert(!store.UserIdAt(presentation::SocialSection::Friends, 99).has_value());
    assert(store.UserIdAt(presentation::SocialSection::Blocked, 1) == 4);

    domain::SocialFriendRequest incoming;
    incoming.requester.id = 8;
    store.ReplaceIncomingRequests({incoming}, {blockedFriend});
    assert(store.UserIdAt(presentation::SocialSection::IncomingRequests, 0) == 8);

    domain::SocialFriendRequest outgoing;
    outgoing.addressee.id = 9;
    store.ReplaceOutgoingRequests({outgoing}, {blockedFriend});
    assert(store.UserIdAt(presentation::SocialSection::OutgoingRequests, 0) == 9);

    domain::SocialProfile profile;
    profile.user.id = 42;
    store.ReplaceProfile(profile);
    assert(store.UserIdAt(presentation::SocialSection::Profile, 0) == 42);

    return 0;
}
