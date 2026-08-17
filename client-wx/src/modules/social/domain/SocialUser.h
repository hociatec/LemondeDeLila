#pragma once

#include <string>

namespace lila::modules::social::domain
{
struct SocialUser final
{
    int id = 0;
    std::string username;
    std::string avatar;
    std::string since;
    std::string createdAt;
    std::string blockedAt;
    std::string profileVisibility;
};
}
