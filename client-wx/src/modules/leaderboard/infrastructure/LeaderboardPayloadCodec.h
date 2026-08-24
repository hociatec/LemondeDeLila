#pragma once

#include <vector>

#include <nlohmann/json_fwd.hpp>

#include "modules/leaderboard/domain/Leaderboard.h"

namespace lila::modules::leaderboard::infrastructure::codec
{
[[nodiscard]] std::vector<domain::LeaderboardGame> ReadGamesPayload(const nlohmann::json& payload);
[[nodiscard]] domain::LeaderboardTop ReadTopPayload(const nlohmann::json& payload);
}
