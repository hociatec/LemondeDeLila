#pragma once

#include <optional>
#include <utility>
#include <vector>

#include "modules/social/application/SocialService.h"
#include "modules/social/domain/SocialFriendRequest.h"
#include "modules/social/domain/SocialProfile.h"
#include "modules/social/domain/SocialUser.h"

namespace lila::modules::social::presentation
{
class SocialLoadController final
{
public:
    struct FriendsSnapshot final
    {
        std::vector<domain::SocialUser> friends;
        std::vector<domain::SocialUser> blockedUsers;
    };

    struct RequestsSnapshot final
    {
        std::vector<domain::SocialFriendRequest> requests;
        std::vector<domain::SocialUser> blockedUsers;
    };

    explicit SocialLoadController(application::SocialService& socialService) noexcept
        : socialService_(socialService)
    {
    }

    [[nodiscard]] FriendsSnapshot LoadFriends() const
    {
        return {socialService_.LoadFriends(), socialService_.LoadBlockedUsers()};
    }

    [[nodiscard]] RequestsSnapshot LoadIncomingRequests() const
    {
        return {socialService_.LoadIncomingRequests(), socialService_.LoadBlockedUsers()};
    }

    [[nodiscard]] RequestsSnapshot LoadOutgoingRequests() const
    {
        return {socialService_.LoadOutgoingRequests(), socialService_.LoadBlockedUsers()};
    }

    [[nodiscard]] std::vector<domain::SocialUser> LoadBlockedUsers() const
    {
        return socialService_.LoadBlockedUsers();
    }

    [[nodiscard]] std::optional<domain::SocialProfile> LoadProfile(std::optional<int> userId) const
    {
        return socialService_.LoadProfile(userId);
    }

private:
    application::SocialService& socialService_;
};
}
