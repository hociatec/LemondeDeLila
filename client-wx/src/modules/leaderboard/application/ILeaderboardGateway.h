#pragma once

#include <stop_token>
#include <string_view>
#include <vector>

#include "modules/leaderboard/domain/Leaderboard.h"

namespace lila::modules::leaderboard::application
{
class ILeaderboardGateway
{
public:
    virtual ~ILeaderboardGateway() = default;
    [[nodiscard]] virtual std::vector<domain::LeaderboardGame> LoadGames(std::stop_token stopToken) const = 0;
    [[nodiscard]] virtual domain::LeaderboardTop LoadTop(
        std::string_view gameType,
        std::stop_token stopToken) const = 0;
};
}
