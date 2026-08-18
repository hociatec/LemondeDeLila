#pragma once

#include <cstddef>
#include <optional>
#include <vector>

#include "modules/social/domain/SocialFriendRequest.h"
#include "modules/social/domain/SocialProfile.h"
#include "modules/social/domain/SocialUser.h"
#include "modules/social/presentation/SocialSection.h"

namespace lila::modules::social::presentation
{
class SocialDataStore final
{
public:
    void ReplaceAll(
        std::vector<domain::SocialUser> friends,
        std::vector<domain::SocialFriendRequest> incomingRequests,
        std::vector<domain::SocialFriendRequest> outgoingRequests,
        std::vector<domain::SocialUser> blockedUsers);
    void ReplaceFriends(
        std::vector<domain::SocialUser> friends,
        std::vector<domain::SocialUser> blockedUsers);
    void ReplaceIncomingRequests(
        std::vector<domain::SocialFriendRequest> requests,
        std::vector<domain::SocialUser> blockedUsers);
    void ReplaceOutgoingRequests(
        std::vector<domain::SocialFriendRequest> requests,
        std::vector<domain::SocialUser> blockedUsers);
    void ReplaceBlockedUsers(std::vector<domain::SocialUser> blockedUsers);
    void ReplaceProfile(std::optional<domain::SocialProfile> profile);

    [[nodiscard]] const std::vector<domain::SocialUser>& Friends() const;
    [[nodiscard]] const std::vector<domain::SocialFriendRequest>& IncomingRequests() const;
    [[nodiscard]] const std::vector<domain::SocialFriendRequest>& OutgoingRequests() const;
    [[nodiscard]] const std::vector<domain::SocialUser>& BlockedUsers() const;
    [[nodiscard]] const std::optional<domain::SocialProfile>& Profile() const;
    [[nodiscard]] bool IsBlocked(int userId) const;
    [[nodiscard]] std::optional<int> UserIdAt(SocialSection section, std::size_t index) const;

private:
    static std::vector<domain::SocialUser> MergeFriendsAndBlockedUsers(
        std::vector<domain::SocialUser> friends,
        const std::vector<domain::SocialUser>& blockedUsers);

    std::vector<domain::SocialUser> friends_;
    std::vector<domain::SocialFriendRequest> incomingRequests_;
    std::vector<domain::SocialFriendRequest> outgoingRequests_;
    std::vector<domain::SocialUser> blockedUsers_;
    std::optional<domain::SocialProfile> profile_;
};
}
