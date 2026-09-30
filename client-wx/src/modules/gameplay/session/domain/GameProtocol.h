#pragma once

#include <string_view>

namespace lila::modules::gameplay::protocol
{
inline constexpr std::string_view Join = "game.join";
inline constexpr std::string_view State = "game.state";
inline constexpr std::string_view Rules = "game.rules";
inline constexpr std::string_view Key = "game.key";
inline constexpr std::string_view Action = "game.action";
inline constexpr std::string_view ActionCandidates = "game.action.candidates";
inline constexpr std::string_view Acknowledgement = "game.ack";
inline constexpr std::string_view Turn = "game.turn";
inline constexpr std::string_view Message = "game.message";
}
