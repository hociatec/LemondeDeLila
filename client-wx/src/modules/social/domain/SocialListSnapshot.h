#pragma once

#include <vector>
#include "modules/social/domain/SocialFriendRequest.h"
#include "modules/social/domain/SocialUser.h"

namespace lila::modules::social::domain
{
struct SocialFriendsSnapshot final
{
    std::vector<SocialUser> friends;
    std::vector<SocialUser> blockedUsers;
};
struct SocialRequestsSnapshot final
{
    std::vector<SocialFriendRequest> requests;
    std::vector<SocialUser> blockedUsers;
};
}
