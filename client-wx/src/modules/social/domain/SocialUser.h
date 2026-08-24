#pragma once

#include "shared/domain/identifiers/DomainTypes.h"

namespace lila::modules::social::domain
{
struct SocialUser final
{
    lila::shared::domain::UserId id{};
    std::string username;
    std::string avatar;
    std::string since;
    std::string createdAt;
    std::string blockedAt;
    lila::shared::domain::ProfileVisibility profileVisibility = lila::shared::domain::ProfileVisibility::Public;
};
}
