#pragma once

#include <array>
#include <string_view>

namespace lila::modules::gameplay::domain::capability
{
inline constexpr std::string_view Cards = "cards";
inline constexpr std::string_view Dice = "dice";
inline constexpr std::string_view Grid = "grid";
inline constexpr std::string_view Movement = "movement";
inline constexpr std::string_view Pawns = "pawns";
inline constexpr std::string_view Score = "score";
inline constexpr std::string_view Resources = "resources";
inline constexpr std::string_view Counters = "counters";
inline constexpr std::string_view Status = "status";
inline constexpr std::string_view Inventory = "inventory";
inline constexpr std::string_view Economy = "economy";
inline constexpr std::string_view Ownership = "ownership";
inline constexpr std::string_view Collections = "collections";
inline constexpr std::string_view Quiz = "quiz";
inline constexpr std::string_view Submissions = "submissions";

inline constexpr std::array Known{
    Cards, Dice, Grid, Movement, Pawns, Score, Resources, Counters, Status,
    Inventory, Economy, Ownership, Collections, Quiz, Submissions};
}
