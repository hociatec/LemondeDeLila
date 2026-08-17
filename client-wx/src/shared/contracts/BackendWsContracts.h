#pragma once

#include <string_view>

namespace lila::shared::contracts
{
namespace chat
{
inline constexpr std::string_view SendEvent = "chat-send";
inline constexpr std::string_view EditEvent = "chat-edit";
inline constexpr std::string_view DeleteEvent = "chat-delete";
inline constexpr std::string_view HistoryEvent = "chat-history";
inline constexpr std::string_view MessageEvent = "chat-message";
inline constexpr std::string_view MessageUpdatedEvent = "chat-message.updated";
inline constexpr std::string_view MessageDeletedEvent = "chat-message.deleted";
inline constexpr std::string_view ErrorEvent = "error";
inline constexpr std::string_view TypeField = "type";
inline constexpr std::string_view PayloadField = "payload";
inline constexpr std::string_view MessagesField = "messages";
inline constexpr std::string_view EditWindowSecondsField = "editWindowSeconds";
inline constexpr std::string_view MessageField = "message";
inline constexpr std::string_view IdField = "id";
inline constexpr std::string_view MessageIdField = "messageId";
inline constexpr std::string_view TextField = "text";
inline constexpr std::string_view FromField = "from";
inline constexpr std::string_view UserField = "user";
inline constexpr std::string_view UsernameField = "username";
inline constexpr std::string_view CreatedAtField = "createdAt";
inline constexpr std::string_view ErrorMessageField = "message";
inline constexpr std::string_view ErrorReasonField = "reason";
inline constexpr std::string_view ErrorUntilField = "until";
}

namespace user
{
inline constexpr std::string_view AuthLoginEvent = "auth.login";
inline constexpr std::string_view AuthRegisterEvent = "auth.register";
inline constexpr std::string_view PayloadField = "payload";
inline constexpr std::string_view UsernameField = "username";
inline constexpr std::string_view PasswordField = "password";
inline constexpr std::string_view EmailField = "email";
inline constexpr std::string_view TokenField = "token";
inline constexpr std::string_view UserIdField = "userId";
inline constexpr std::string_view MessageField = "message";
inline constexpr std::string_view JwtUserIdField = "id";
}

namespace social
{
inline constexpr std::string_view FriendsListEvent = "social.friends.list";
inline constexpr std::string_view FriendsRequestsEvent = "social.friends.requests";
inline constexpr std::string_view FriendsBlockedEvent = "social.friends.blocked";
inline constexpr std::string_view FriendsRequestEvent = "social.friends.request";
inline constexpr std::string_view FriendsAcceptEvent = "social.friends.accept";
inline constexpr std::string_view FriendsRejectEvent = "social.friends.reject";
inline constexpr std::string_view FriendsCancelEvent = "social.friends.cancel";
inline constexpr std::string_view FriendsRemoveEvent = "social.friends.remove";
inline constexpr std::string_view FriendsBlockEvent = "social.friends.block";
inline constexpr std::string_view FriendsUnblockEvent = "social.friends.unblock";
inline constexpr std::string_view ProfileGetEvent = "social.profile.get";
inline constexpr std::string_view ProfileUpdateEvent = "social.profile.update";
inline constexpr std::string_view ProfileSearchEvent = "social.user.search";
inline constexpr std::string_view FriendDirectionIncoming = "incoming";
inline constexpr std::string_view FriendDirectionOutgoing = "outgoing";
inline constexpr std::string_view ProfileItemsKey = "profile";
inline constexpr std::string_view ItemsKey = "items";
inline constexpr std::string_view TypeField = "type";
inline constexpr std::string_view PayloadField = "payload";
inline constexpr std::string_view QueryField = "query";
inline constexpr std::string_view UserIdField = "userId";
inline constexpr std::string_view DirectionField = "direction";
inline constexpr std::string_view DirectionIncoming = "incoming";
inline constexpr std::string_view DirectionOutgoing = "outgoing";
inline constexpr std::string_view SearchFieldId = "id";
inline constexpr std::string_view SearchFieldUsername = "username";
inline constexpr std::string_view SearchFieldAvatar = "avatar";
inline constexpr std::string_view SearchFieldSince = "since";
inline constexpr std::string_view SearchFieldCreatedAt = "createdAt";
inline constexpr std::string_view SearchFieldBlockedAt = "blockedAt";
inline constexpr std::string_view SearchFieldProfileVisibility = "profileVisibility";
inline constexpr std::string_view SocialIdField = "id";
inline constexpr std::string_view SocialProfileField = "profile";
inline constexpr std::string_view SocialBioField = "bio";
inline constexpr std::string_view SocialVictoryMessageField = "victoryMessage";
inline constexpr std::string_view SocialDefeatMessageField = "defeatMessage";
inline constexpr std::string_view SocialVisibilityField = "visibility";
inline constexpr std::string_view SocialCreatedAtField = "createdAt";
inline constexpr std::string_view SocialUpdatedAtField = "updatedAt";
inline constexpr std::string_view SocialIsOwnerField = "isOwner";
inline constexpr std::string_view SocialCanViewField = "canView";
inline constexpr std::string_view SocialRequesterField = "requester";
inline constexpr std::string_view SocialAddresseeField = "addressee";
}

namespace messaging
{
inline constexpr std::string_view ConversationEvent = "messaging.conversation";
inline constexpr std::string_view MessagesEvent = "messaging.messages";
inline constexpr std::string_view SendEvent = "messaging.send";
inline constexpr std::string_view DeleteEvent = "messaging.delete";
inline constexpr std::string_view RestoreEvent = "messaging.restore";
inline constexpr std::string_view PurgeEvent = "messaging.purge";
inline constexpr std::string_view SearchEvent = "messaging.search";
inline constexpr std::string_view MarkReadEvent = "messaging.markRead";
inline constexpr std::string_view MessageSentEvent = "messaging.message";
inline constexpr std::string_view MessageDeletedEvent = "messaging.deleted";
inline constexpr std::string_view MessageRestoredEvent = "messaging.restored";
inline constexpr std::string_view MessagePurgedEvent = "messaging.purged";
inline constexpr std::string_view MessageKey = "message";
inline constexpr std::string_view SearchResultKey = "user";
inline constexpr std::string_view BoxKey = "box";
inline constexpr std::string_view QueryField = "query";
inline constexpr std::string_view QueryAltField = "username";
inline constexpr std::string_view LimitField = "limit";
inline constexpr std::string_view ConversationUserIdField = "userId";
inline constexpr std::string_view RecipientIdField = "recipientId";
inline constexpr std::string_view MessageIdField = "messageId";
inline constexpr std::string_view TextField = "text";
inline constexpr std::string_view SubjectField = "subject";
inline constexpr std::string_view TypeField = "type";
inline constexpr std::string_view PayloadField = "payload";
inline constexpr std::string_view ItemsKey = "items";
inline constexpr std::string_view DirectionField = "direction";
inline constexpr std::string_view DeletedAtField = "deletedAt";
inline constexpr std::string_view BoxTypeField = "boxType";
inline constexpr std::string_view SenderField = "sender";
inline constexpr std::string_view RecipientField = "recipient";
inline constexpr std::string_view CreatedAtField = "createdAt";
inline constexpr std::string_view SentDirection = "sent";
inline constexpr std::string_view ReceivedDirection = "received";
inline constexpr std::string_view InboxBox = "inbox";
inline constexpr std::string_view OutboxBox = "outbox";
inline constexpr std::string_view DeletedBox = "deleted";
inline constexpr std::string_view IdField = "id";
}

namespace session
{
inline constexpr std::string_view UserIdField = "userId";
inline constexpr std::string_view UsernameField = "username";
inline constexpr std::string_view TokenField = "token";
}
}
