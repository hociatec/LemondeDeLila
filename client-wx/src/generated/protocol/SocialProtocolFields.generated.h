// Generated from ../backend/src/social/{services,ws}. Do not edit manually.
#pragma once

#include <string_view>

namespace lila::modules::social::infrastructure::fields
{
inline constexpr std::string_view DirectionIncoming = "incoming";
inline constexpr std::string_view DirectionOutgoing = "outgoing";
inline constexpr std::string_view DirectionAll = "all";
inline constexpr std::string_view ProfileItems = "profile";
inline constexpr std::string_view Items = "items";
inline constexpr std::string_view Type = "type";
inline constexpr std::string_view Payload = "payload";
inline constexpr std::string_view Query = "query";
inline constexpr std::string_view UserId = "userId";
inline constexpr std::string_view Direction = "direction";
inline constexpr std::string_view SearchId = "id";
inline constexpr std::string_view SearchUsername = "username";
inline constexpr std::string_view SearchAvatar = "avatar";
inline constexpr std::string_view SearchSince = "since";
inline constexpr std::string_view SearchCreatedAt = "createdAt";
inline constexpr std::string_view SearchBlockedAt = "blockedAt";
inline constexpr std::string_view SearchProfileVisibility = "profileVisibility";
inline constexpr std::string_view SocialId = "id";
inline constexpr std::string_view SocialProfile = "user";
inline constexpr std::string_view SocialBio = "bio";
inline constexpr std::string_view SocialVictoryMessage = "victoryMessage";
inline constexpr std::string_view SocialDefeatMessage = "defeatMessage";
inline constexpr std::string_view SocialVisibility = "visibility";
inline constexpr std::string_view SocialVisibilityPublic = "public";
inline constexpr std::string_view SocialVisibilityFriends = "friends";
inline constexpr std::string_view SocialVisibilityPrivate = "private";
inline constexpr std::string_view SocialCreatedAt = "createdAt";
inline constexpr std::string_view SocialUpdatedAt = "updatedAt";
inline constexpr std::string_view SocialIsOwner = "isOwner";
inline constexpr std::string_view SocialCanView = "canView";
inline constexpr std::string_view SocialRequester = "requester";
inline constexpr std::string_view SocialAddressee = "addressee";
}
