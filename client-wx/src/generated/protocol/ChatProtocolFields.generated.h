// Generated from backend/contracts/client-wx-fields.json. Do not edit manually.
#pragma once

#include <cstddef>
#include <string_view>

namespace lila::modules::chat::infrastructure::fields
{
inline constexpr int DefaultHistoryLoadLimit = 300;
inline constexpr std::size_t MaxHistoryMessages = 500;
inline constexpr std::string_view Type = "type";
inline constexpr std::string_view Payload = "payload";
inline constexpr std::string_view Messages = "messages";
inline constexpr std::string_view EditWindowSeconds = "editWindowSeconds";
inline constexpr std::string_view Message = "message";
inline constexpr std::string_view Id = "id";
inline constexpr std::string_view MessageId = "messageId";
inline constexpr std::string_view Text = "text";
inline constexpr std::string_view From = "from";
inline constexpr std::string_view User = "user";
inline constexpr std::string_view Username = "username";
inline constexpr std::string_view CreatedAt = "createdAt";
inline constexpr std::string_view ErrorMessage = "message";
inline constexpr std::string_view ErrorReason = "reason";
inline constexpr std::string_view ErrorUntil = "until";
}
