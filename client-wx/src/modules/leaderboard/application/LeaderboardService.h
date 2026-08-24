#pragma once

#include <stop_token>
#include <string_view>
#include <vector>

#include "modules/leaderboard/domain/Leaderboard.h"

namespace lila::modules::leaderboard::application
{
class ILeaderboardGateway;

class LeaderboardService final
{
public:
    explicit LeaderboardService(ILeaderboardGateway& gateway) noexcept;
    [[nodiscard]] std::vector<domain::LeaderboardGame> LoadGames(std::stop_token stopToken) const;
    [[nodiscard]] domain::LeaderboardTop LoadTop(
        std::string_view gameType,
        std::stop_token stopToken) const;

private:
    ILeaderboardGateway& gateway_;
};
}
