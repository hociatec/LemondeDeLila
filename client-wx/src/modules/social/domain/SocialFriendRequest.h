#pragma once

#include "modules/social/domain/SocialUser.h"

namespace lila::modules::social::domain
{
struct SocialFriendRequest final
{
    lila::shared::domain::UserId id{};
    SocialUser requester;
    SocialUser addressee;
    std::string createdAt;
};
}
