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
    using FriendsSnapshot = domain::SocialFriendsSnapshot;
    using RequestsSnapshot = domain::SocialRequestsSnapshot;

    explicit SocialLoadController(application::SocialService& socialService) noexcept
        : socialService_(socialService)
    {
    }

    [[nodiscard]] FriendsSnapshot LoadFriends() const
    {
        return socialService_.LoadFriendsSnapshot();
    }

    [[nodiscard]] RequestsSnapshot LoadIncomingRequests() const
    {
        return socialService_.LoadIncomingSnapshot();
    }

    [[nodiscard]] RequestsSnapshot LoadOutgoingRequests() const
    {
        return socialService_.LoadOutgoingSnapshot();
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
