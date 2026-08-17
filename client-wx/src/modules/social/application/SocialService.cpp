#include "modules/social/application/SocialService.h"

namespace lila::modules::social::application
{
SocialService::SocialService(ISocialGateway& api)
    : api_(api)
{
}

std::vector<domain::SocialUser> SocialService::LoadFriends() const
{
    return api_.GetFriends();
}

std::vector<domain::SocialFriendRequest> SocialService::LoadIncomingRequests() const
{
    return api_.GetRequests("incoming");
}

std::vector<domain::SocialFriendRequest> SocialService::LoadOutgoingRequests() const
{
    return api_.GetRequests("outgoing");
}

std::vector<domain::SocialUser> SocialService::LoadBlockedUsers() const
{
    return api_.GetBlockedUsers();
}

std::optional<domain::SocialProfile> SocialService::LoadProfile(std::optional<int> userId) const
{
    return api_.GetProfile(userId);
}

std::optional<domain::SocialProfile> SocialService::SaveProfile(const domain::SocialProfileUpdate& update) const
{
    return api_.UpdateProfile(update);
}

void SocialService::AcceptFriend(int userId) const
{
    static_cast<void>(api_.AcceptFriend(userId));
}

void SocialService::RejectFriend(int userId) const
{
    static_cast<void>(api_.RejectFriend(userId));
}

void SocialService::CancelRequest(int userId) const
{
    static_cast<void>(api_.CancelRequest(userId));
}

void SocialService::RemoveFriend(int userId) const
{
    static_cast<void>(api_.RemoveFriend(userId));
}

void SocialService::BlockUser(int userId) const
{
    static_cast<void>(api_.BlockUser(userId));
}

void SocialService::UnblockUser(int userId) const
{
    static_cast<void>(api_.UnblockUser(userId));
}

void SocialService::RequestFriend(int userId) const
{
    static_cast<void>(api_.RequestFriend(userId));
}

std::vector<domain::SocialUser> SocialService::SearchUsers(const std::string& query) const
{
    return api_.SearchUsers(query);
}
}
