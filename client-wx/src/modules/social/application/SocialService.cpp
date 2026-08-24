#include "modules/social/application/SocialService.h"

#include "modules/social/infrastructure/SocialProtocolFields.h"

namespace lila::modules::social::application
{
SocialService::SocialService(ISocialGateway& api)
    : api_(api)
{
}

std::vector<domain::SocialUser> SocialService::LoadFriends() const
{
    return friendsCache_.GetOrLoad({}, [this](std::stop_token) { return api_.GetFriends(); })
        .value_or(std::vector<domain::SocialUser>{});
}

std::vector<domain::SocialFriendRequest> SocialService::LoadIncomingRequests() const
{
    return incomingRequestsCache_.GetOrLoad(
        {},
        [this](std::stop_token)
        {
            return api_.GetRequests(
                std::string(lila::modules::social::infrastructure::fields::DirectionIncoming));
        }).value_or(std::vector<domain::SocialFriendRequest>{});
}

std::vector<domain::SocialFriendRequest> SocialService::LoadOutgoingRequests() const
{
    return outgoingRequestsCache_.GetOrLoad(
        {},
        [this](std::stop_token)
        {
            return api_.GetRequests(
                std::string(lila::modules::social::infrastructure::fields::DirectionOutgoing));
        }).value_or(std::vector<domain::SocialFriendRequest>{});
}

std::vector<domain::SocialUser> SocialService::LoadBlockedUsers() const
{
    return blockedUsersCache_.GetOrLoad({}, [this](std::stop_token) { return api_.GetBlockedUsers(); })
        .value_or(std::vector<domain::SocialUser>{});
}

std::optional<domain::SocialProfile> SocialService::LoadProfile(std::optional<int> userId) const
{
    if (userId.has_value())
    {
        return api_.GetProfile(userId);
    }

    return ownProfileCache_.GetOrLoad({}, [this](std::stop_token) { return api_.GetProfile(std::nullopt); })
        .value_or(std::optional<domain::SocialProfile>{});
}

std::optional<domain::SocialProfile> SocialService::SaveProfile(const domain::SocialProfileUpdate& update) const
{
    auto profile = api_.UpdateProfile(update);
    ownProfileCache_.Store(profile);
    return profile;
}

void SocialService::AcceptFriend(int userId) const
{
    static_cast<void>(api_.AcceptFriend(userId));
    ClearRelationshipCache();
}

void SocialService::RejectFriend(int userId) const
{
    static_cast<void>(api_.RejectFriend(userId));
    ClearRelationshipCache();
}

void SocialService::CancelRequest(int userId) const
{
    static_cast<void>(api_.CancelRequest(userId));
    ClearRelationshipCache();
}

void SocialService::RemoveFriend(int userId) const
{
    static_cast<void>(api_.RemoveFriend(userId));
    ClearRelationshipCache();
}

void SocialService::BlockUser(int userId) const
{
    static_cast<void>(api_.BlockUser(userId));
    ClearRelationshipCache();
}

void SocialService::UnblockUser(int userId) const
{
    static_cast<void>(api_.UnblockUser(userId));
    ClearRelationshipCache();
}

void SocialService::RequestFriend(int userId) const
{
    static_cast<void>(api_.RequestFriend(userId));
    ClearRelationshipCache();
}

std::vector<domain::SocialUser> SocialService::SearchUsers(const std::string& query) const
{
    return api_.SearchUsers(query);
}

void SocialService::ClearCache()
{
    ClearRelationshipCache();
    ownProfileCache_.Clear();
}

void SocialService::ClearRelationshipCache() const
{
    friendsCache_.Clear();
    incomingRequestsCache_.Clear();
    outgoingRequestsCache_.Clear();
    blockedUsersCache_.Clear();
}
}
