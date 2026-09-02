#pragma once

#include <string_view>

namespace lila::modules::rooms::infrastructure::protocol
{
inline constexpr std::string_view IntentExecute = "room.intent.execute";
inline constexpr std::string_view Intent = "room.intent";
inline constexpr std::string_view Create = "room.create";
inline constexpr std::string_view Join = "room.join";
inline constexpr std::string_view Leave = "room.leave";
inline constexpr std::string_view Start = "room.start";
inline constexpr std::string_view Reset = "room.reset";
inline constexpr std::string_view AddBot = "bot.add";
inline constexpr std::string_view RemoveBot = "bot.remove";
inline constexpr std::string_view TogglePrivacy = "room.toggle-privacy";
inline constexpr std::string_view SetRole = "room.set-role";
inline constexpr std::string_view Info = "room.info";
inline constexpr std::string_view SendChat = "room.chat.send";
inline constexpr std::string_view ChatHistoryRequest = "room.chat.history";
inline constexpr std::string_view Ping = "room.ping";
inline constexpr std::string_view Kick = "room.kick";
inline constexpr std::string_view Ban = "room.ban";
inline constexpr std::string_view SetAmbience = "room.set-ambience";
inline constexpr std::string_view SetOwner = "room.set-owner";

inline constexpr std::string_view Created = "room.created";
inline constexpr std::string_view Joined = "room.joined";
inline constexpr std::string_view Updated = "room.updated";
inline constexpr std::string_view Privacy = "room.privacy";
inline constexpr std::string_view Role = "room.role";
inline constexpr std::string_view BotAdded = "bot.added";
inline constexpr std::string_view BotRemoved = "bot.removed";
inline constexpr std::string_view InfoResult = "room.info";
inline constexpr std::string_view ChatMessage = "room.chat.message";
inline constexpr std::string_view ChatHistory = "room.chat.history";
inline constexpr std::string_view Ack = "room.ack";
inline constexpr std::string_view Pong = "room.pong";
inline constexpr std::string_view Left = "room.left";
inline constexpr std::string_view Deleted = "room.deleted";
inline constexpr std::string_view Error = "error";
}
