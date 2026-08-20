#pragma once

#include <string_view>

namespace lila::shared::network::realtime::fields
{
inline constexpr std::string_view Type = "type";
inline constexpr std::string_view RequestId = "requestId";
inline constexpr std::string_view Payload = "payload";
inline constexpr std::string_view ProtocolVersion = "protocolVersion";
inline constexpr std::string_view ClientVersion = "clientVersion";
inline constexpr std::string_view Success = "success";
inline constexpr std::string_view Message = "message";
inline constexpr std::string_view Error = "error";
inline constexpr std::string_view ErrorType = "error";
}
