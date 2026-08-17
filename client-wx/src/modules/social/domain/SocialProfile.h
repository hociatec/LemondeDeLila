#pragma once

#include "modules/social/domain/SocialUser.h"

namespace lila::modules::social::domain
{
struct SocialProfile final
{
    SocialUser user;
    std::string bio;
    std::string victoryMessage;
    std::string defeatMessage;
    std::string visibility = "public";
    std::string createdAt;
    std::string updatedAt;
    bool isOwner = false;
    bool canView = false;
};

struct SocialProfileUpdate final
{
    std::string bio;
    std::string victoryMessage;
    std::string defeatMessage;
    std::string visibility = "public";
};
}
