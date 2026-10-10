#include "modules/social/application/SocialService.h"

#include <algorithm>

#include "modules/audio/application/IAudioService.h"
#include "generated/protocol/SocialProtocolFields.generated.h"

namespace lila::modules::social::application
{
SocialService::SocialService(
    ISocialGateway& api,
    lila::modules::audio::application::IAudioService& audioService)
    : api_(api),
      audioService_(audioService)
{
}

std::vector<domain::SocialUser> SocialService::LoadFriends() const
{
    return LoadFriendsSnapshot().friends;
}

std::vector<domain::SocialFriendRequest> SocialService::LoadIncomingRequests() const
{
    return LoadIncomingSnapshot().requests;
}

std::vector<domain::SocialFriendRequest> SocialService::LoadOutgoingRequests() const
{
    return LoadOutgoingSnapshot().requests;
}

domain::SocialFriendsSnapshot SocialService::LoadFriendsSnapshot() const
{
    std::size_t generation;
    {
        std::scoped_lock lock(friendsMutex_);
        generation = ++friendsGeneration_;
    }
    auto snapshot = api_.GetFriendsSnapshot();
    // Keep a hint for presence notifications, never use it to serve a screen.
    {
        std::scoped_lock lock(friendsMutex_);
        if (generation == friendsGeneration_) friendsHint_ = snapshot;
    }
    return snapshot;
}

domain::SocialRequestsSnapshot SocialService::LoadIncomingSnapshot() const
{
    return api_.GetRequestsSnapshot(
        std::string(lila::modules::social::infrastructure::fields::DirectionIncoming));
}

domain::SocialRequestsSnapshot SocialService::LoadOutgoingSnapshot() const
{
    return api_.GetRequestsSnapshot(
        std::string(lila::modules::social::infrastructure::fields::DirectionOutgoing));
}

std::vector<domain::SocialUser> SocialService::LoadBlockedUsers() const
{
    return api_.GetBlockedUsers();
}

domain::SocialRelationshipState SocialService::LoadRelationshipState(int userId) const
{
    return api_.GetRelationshipState(userId);
}

std::optional<domain::SocialProfile> SocialService::LoadProfile(std::optional<int> userId) const
{
    if (userId.has_value())
    {
        return api_.GetProfile(userId);
    }

    // A failed or incomplete response must never make "Mon profil" unusable
    // for the remainder of the application session.
    return api_.GetProfile(std::nullopt);
}

std::optional<domain::SocialProfile> SocialService::SaveProfile(const domain::SocialProfileUpdate& update) const
{
    return api_.UpdateProfile(update);
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
    if (api_.RequestFriend(userId))
    {
        audioService_.Play(
            lila::modules::audio::domain::SoundCue::FriendInvitationSent);
    }
    ClearRelationshipCache();
}

std::vector<domain::SocialUser> SocialService::SearchUsers(const std::string& query) const
{
    return api_.SearchUsers(query);
}

bool SocialService::IsFriendCached(int userId) const
{
    std::scoped_lock lock(friendsMutex_);
    return friendsHint_.has_value() && std::ranges::any_of(
        friendsHint_->friends,
        [userId](const domain::SocialUser& user) { return user.id.value == userId; });
}

void SocialService::ClearCache()
{
    ClearRelationshipCache();
}

void SocialService::ClearRelationshipCache() const
{
    std::scoped_lock lock(friendsMutex_);
    ++friendsGeneration_;
    friendsHint_.reset();
}
}
