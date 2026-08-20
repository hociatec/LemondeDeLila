#include "modules/social/presentation/SocialDataStore.h"

#include <algorithm>
#include <unordered_set>
#include <utility>

namespace lila::modules::social::presentation
{
void SocialDataStore::ReplaceAll(
    std::vector<domain::SocialUser> friends,
    std::vector<domain::SocialFriendRequest> incomingRequests,
    std::vector<domain::SocialFriendRequest> outgoingRequests,
    std::vector<domain::SocialUser> blockedUsers)
{
    blockedUsers_ = std::move(blockedUsers);
    friends_ = MergeFriendsAndBlockedUsers(std::move(friends), blockedUsers_);
    incomingRequests_ = std::move(incomingRequests);
    outgoingRequests_ = std::move(outgoingRequests);
}

void SocialDataStore::ReplaceFriends(
    std::vector<domain::SocialUser> friends,
    std::vector<domain::SocialUser> blockedUsers)
{
    blockedUsers_ = std::move(blockedUsers);
    friends_ = MergeFriendsAndBlockedUsers(std::move(friends), blockedUsers_);
}

void SocialDataStore::ReplaceIncomingRequests(
    std::vector<domain::SocialFriendRequest> requests,
    std::vector<domain::SocialUser> blockedUsers)
{
    incomingRequests_ = std::move(requests);
    blockedUsers_ = std::move(blockedUsers);
}

void SocialDataStore::ReplaceOutgoingRequests(
    std::vector<domain::SocialFriendRequest> requests,
    std::vector<domain::SocialUser> blockedUsers)
{
    outgoingRequests_ = std::move(requests);
    blockedUsers_ = std::move(blockedUsers);
}

void SocialDataStore::ReplaceBlockedUsers(std::vector<domain::SocialUser> blockedUsers)
{
    blockedUsers_ = std::move(blockedUsers);
}

void SocialDataStore::ReplaceProfile(std::optional<domain::SocialProfile> profile)
{
    profile_ = std::move(profile);
}

const std::vector<domain::SocialUser>& SocialDataStore::Friends() const
{
    return friends_;
}

const std::vector<domain::SocialFriendRequest>& SocialDataStore::IncomingRequests() const
{
    return incomingRequests_;
}

const std::vector<domain::SocialFriendRequest>& SocialDataStore::OutgoingRequests() const
{
    return outgoingRequests_;
}

const std::vector<domain::SocialUser>& SocialDataStore::BlockedUsers() const
{
    return blockedUsers_;
}

const std::optional<domain::SocialProfile>& SocialDataStore::Profile() const
{
    return profile_;
}

bool SocialDataStore::IsBlocked(lila::shared::domain::UserId userId) const
{
    return userId.IsValid() && std::any_of(
        blockedUsers_.begin(),
        blockedUsers_.end(),
        [userId](const domain::SocialUser& user)
        {
            return user.id == userId;
        });
}

std::optional<int> SocialDataStore::UserIdAt(SocialSection section, std::size_t index) const
{
    switch (section)
    {
    case SocialSection::Friends:
        return index < friends_.size() ? std::optional<int>{static_cast<int>(friends_[index].id.value)} : std::nullopt;
    case SocialSection::IncomingRequests:
        return index < incomingRequests_.size()
            ? std::optional<int>{static_cast<int>(incomingRequests_[index].requester.id.value)}
            : std::nullopt;
    case SocialSection::OutgoingRequests:
        return index < outgoingRequests_.size()
            ? std::optional<int>{static_cast<int>(outgoingRequests_[index].addressee.id.value)}
            : std::nullopt;
    case SocialSection::Blocked:
        return index < blockedUsers_.size() ? std::optional<int>{static_cast<int>(blockedUsers_[index].id.value)} : std::nullopt;
    case SocialSection::Profile:
        return profile_.has_value() ? std::optional<int>{static_cast<int>(profile_->user.id.value)} : std::nullopt;
    }

    return std::nullopt;
}

std::vector<domain::SocialUser> SocialDataStore::MergeFriendsAndBlockedUsers(
    std::vector<domain::SocialUser> friends,
    const std::vector<domain::SocialUser>& blockedUsers)
{
    std::unordered_set<lila::shared::domain::UserId> friendIds;
    friendIds.reserve(friends.size() + blockedUsers.size());
    for (const auto& friendUser : friends)
    {
        if (friendUser.id.IsValid())
        {
            friendIds.insert(friendUser.id);
        }
    }

    for (const auto& blockedUser : blockedUsers)
    {
        const bool wasFriend = !blockedUser.since.empty();
        if (!blockedUser.id.IsValid() || !wasFriend || friendIds.contains(blockedUser.id))
        {
            continue;
        }

        friends.push_back(blockedUser);
        friendIds.insert(blockedUser.id);
    }

    return friends;
}
}
