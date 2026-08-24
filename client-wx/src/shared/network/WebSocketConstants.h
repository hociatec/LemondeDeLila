#pragma once

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
inline constexpr std::string_view WsTicketHeader = "x-lila-ws-ticket";
inline constexpr std::string_view WsTicketScopeApi = "api";
inline constexpr std::string_view WsTicketScopePresence = "presence";
inline constexpr std::string_view WsTicketScopeRoom = "room";
inline constexpr std::string_view WsTicketPath = "/ws/ticket?scope=";
inline constexpr std::string_view WsTicketApiPath = "/api/ws/ticket?scope=";
inline constexpr std::string_view WsTicketResponseField = "ticket";
inline constexpr std::string_view PresencePath = "/presence";
inline constexpr std::string_view PresenceContextQuery = "?context=";
inline constexpr std::string_view PresenceContextChat = "chat";
}
