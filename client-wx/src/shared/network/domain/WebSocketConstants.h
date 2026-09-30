#pragma once

#include <cstddef>
#include <string>
#include <string_view>

namespace lila::shared::network::ws
{
inline constexpr std::string_view WsScheme = "ws://";
inline constexpr std::string_view WssScheme = "wss://";
inline constexpr std::string_view HttpScheme = "http://";
inline constexpr std::string_view HttpsScheme = "https://";
inline constexpr std::string_view AuthorizationHeader = "Authorization";
inline constexpr std::string_view AuthorizationScheme = "Bearer ";
inline constexpr std::string_view ClientVersionHeader = "x-lila-client-version";
inline constexpr std::string_view ClientProductHeader = "x-lila-client-product";
inline constexpr std::string_view ClientProduct = "client-wx";
inline constexpr std::string_view WsTicketHeader = "x-lila-ws-ticket";
inline constexpr std::string_view WsTicketScopeApi = "api";
inline constexpr std::string_view WsTicketScopePresence = "presence";
inline constexpr std::string_view WsTicketScopeRoom = "room";
inline constexpr std::string_view WsTicketScopeGame = "game";
inline constexpr std::string_view WsTicketScopeNotify = "notify";
inline constexpr std::string_view WsTicketPath = "/api/ws/ticket?scope=";
inline constexpr std::string_view WsTicketResponseField = "ticket";
inline constexpr std::string_view PresencePath = "/presence";
inline constexpr std::string_view GamePath = "/ws/game";
inline constexpr std::string_view NotifyPath = "/ws/notify";
inline constexpr std::string_view PresenceContextQuery = "?context=";
inline constexpr std::string_view PresenceContextChat = "chat";
inline constexpr std::size_t MaximumWebSocketMessageBytes = 1024U * 1024U;

[[nodiscard]] constexpr bool IsWebSocketPayloadSizeAllowed(std::size_t bytes) noexcept
{
    return bytes <= MaximumWebSocketMessageBytes;
}

[[nodiscard]] constexpr bool CanAppendWebSocketFragment(
    std::size_t accumulated,
    std::size_t fragment) noexcept
{
    return accumulated <= MaximumWebSocketMessageBytes &&
        fragment <= MaximumWebSocketMessageBytes - accumulated;
}

[[nodiscard]] inline bool AppendWebSocketFragment(
    std::string& message,
    std::string_view fragment)
{
    if (!CanAppendWebSocketFragment(message.size(), fragment.size())) return false;
    message.append(fragment);
    return true;
}
}
