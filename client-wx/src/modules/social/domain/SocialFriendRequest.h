#pragma once

#include "modules/social/domain/SocialUser.h"

namespace lila::modules::social::domain
{
struct SocialFriendRequest final
{
    int id = 0;
    SocialUser requester;
    SocialUser addressee;
    std::string createdAt;
};
}
