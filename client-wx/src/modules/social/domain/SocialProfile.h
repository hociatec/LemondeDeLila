#pragma once

#include "shared/contracts/BackendWsContracts.h"

#include "modules/social/domain/SocialUser.h"

namespace lila::modules::social::domain
{
struct SocialProfile final
{
    SocialUser user;
    std::string bio;
    std::string victoryMessage;
    std::string defeatMessage;
    std::string visibility = std::string(lila::shared::contracts::social::SocialVisibilityPublic);
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
    std::string visibility = std::string(lila::shared::contracts::social::SocialVisibilityPublic);
};
}
