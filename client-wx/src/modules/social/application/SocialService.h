#pragma once

#include <optional>
#include <string>
#include <vector>

#include "modules/social/domain/SocialFriendRequest.h"
#include "modules/social/domain/SocialProfile.h"
#include "modules/social/domain/SocialUser.h"
#include "modules/social/application/ISocialGateway.h"
#include "shared/cache/application/SingleFlightCache.h"

namespace lila::modules::audio::application { class IAudioService; }

namespace lila::modules::social::application
{
class SocialService final
{
public:
    SocialService(
        ISocialGateway& api,
        lila::modules::audio::application::IAudioService& audioService);

    [[nodiscard]] std::vector<domain::SocialUser> LoadFriends() const;
    [[nodiscard]] std::vector<domain::SocialFriendRequest> LoadIncomingRequests() const;
    [[nodiscard]] std::vector<domain::SocialFriendRequest> LoadOutgoingRequests() const;
    [[nodiscard]] std::vector<domain::SocialUser> LoadBlockedUsers() const;
    [[nodiscard]] std::optional<domain::SocialProfile> LoadProfile(std::optional<int> userId = std::nullopt) const;
    [[nodiscard]] std::optional<domain::SocialProfile> SaveProfile(const domain::SocialProfileUpdate& update) const;
    void AcceptFriend(int userId) const;
    void RejectFriend(int userId) const;
    void CancelRequest(int userId) const;
    void RemoveFriend(int userId) const;
    void BlockUser(int userId) const;
    void UnblockUser(int userId) const;
    void RequestFriend(int userId) const;
    [[nodiscard]] std::vector<domain::SocialUser> SearchUsers(const std::string& query) const;
    [[nodiscard]] bool IsFriendCached(int userId) const;
    void ClearCache();

private:
    void ClearRelationshipCache() const;

    ISocialGateway& api_;
    lila::modules::audio::application::IAudioService& audioService_;
    mutable lila::shared::cache::SingleFlightCache<std::vector<domain::SocialUser>> friendsCache_;
    mutable lila::shared::cache::SingleFlightCache<std::vector<domain::SocialFriendRequest>> incomingRequestsCache_;
    mutable lila::shared::cache::SingleFlightCache<std::vector<domain::SocialFriendRequest>> outgoingRequestsCache_;
    mutable lila::shared::cache::SingleFlightCache<std::vector<domain::SocialUser>> blockedUsersCache_;
    mutable lila::shared::cache::SingleFlightCache<std::optional<domain::SocialProfile>> ownProfileCache_;
};
}
