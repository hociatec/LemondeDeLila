#pragma once

#include <optional>
#include <string>
#include <vector>

#include "modules/social/domain/SocialFriendRequest.h"
#include "modules/social/domain/SocialProfile.h"
#include "modules/social/domain/SocialUser.h"

namespace lila::modules::social::application
{
class ISocialGateway
{
public:
    virtual ~ISocialGateway() = default;
    [[nodiscard]] virtual std::vector<domain::SocialUser> GetFriends() const = 0;
    [[nodiscard]] virtual std::vector<domain::SocialFriendRequest> GetRequests(const std::string& direction) const = 0;
    [[nodiscard]] virtual std::vector<domain::SocialUser> GetBlockedUsers() const = 0;
    [[nodiscard]] virtual bool RequestFriend(int userId) const = 0;
    [[nodiscard]] virtual bool AcceptFriend(int userId) const = 0;
    [[nodiscard]] virtual bool RejectFriend(int userId) const = 0;
    [[nodiscard]] virtual bool CancelRequest(int userId) const = 0;
    [[nodiscard]] virtual bool RemoveFriend(int userId) const = 0;
    [[nodiscard]] virtual bool BlockUser(int userId) const = 0;
    [[nodiscard]] virtual bool UnblockUser(int userId) const = 0;
    [[nodiscard]] virtual std::vector<domain::SocialUser> SearchUsers(const std::string& query) const = 0;
    [[nodiscard]] virtual std::optional<domain::SocialProfile> GetProfile(std::optional<int> userId) const = 0;
    [[nodiscard]] virtual std::optional<domain::SocialProfile> UpdateProfile(const domain::SocialProfileUpdate& update) const = 0;
};
}
