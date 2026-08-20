// Generated from ../backend/src/messaging/{services,ws}. Do not edit manually.
#pragma once

#include <string_view>

namespace lila::modules::messaging::infrastructure::fields
{
inline constexpr int DefaultPageLimit = 100;
inline constexpr std::string_view Message = "message";
inline constexpr std::string_view SearchResult = "user";
inline constexpr std::string_view Box = "box";
inline constexpr std::string_view Query = "query";
inline constexpr std::string_view QueryAlt = "username";
inline constexpr std::string_view Limit = "limit";
inline constexpr std::string_view ConversationUserId = "userId";
inline constexpr std::string_view RecipientId = "recipientId";
inline constexpr std::string_view MessageId = "messageId";
inline constexpr std::string_view Text = "text";
inline constexpr std::string_view Subject = "subject";
inline constexpr std::string_view Type = "type";
inline constexpr std::string_view Payload = "payload";
inline constexpr std::string_view Items = "items";
inline constexpr std::string_view Direction = "direction";
inline constexpr std::string_view DeletedAt = "deletedAt";
inline constexpr std::string_view BoxType = "boxType";
inline constexpr std::string_view Sender = "sender";
inline constexpr std::string_view Recipient = "recipient";
inline constexpr std::string_view CreatedAt = "createdAt";
inline constexpr std::string_view SentDirection = "sent";
inline constexpr std::string_view ReceivedDirection = "received";
inline constexpr std::string_view InboxBox = "inbox";
inline constexpr std::string_view OutboxBox = "outbox";
inline constexpr std::string_view DeletedBox = "deleted";
inline constexpr std::string_view Id = "id";
}
