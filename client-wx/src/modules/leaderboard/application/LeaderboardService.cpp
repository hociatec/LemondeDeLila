#include "modules/leaderboard/application/LeaderboardService.h"

#include "modules/leaderboard/application/ILeaderboardGateway.h"

namespace lila::modules::leaderboard::application
{
LeaderboardService::LeaderboardService(ILeaderboardGateway& gateway) noexcept
    : gateway_(gateway)
{
}

std::vector<domain::LeaderboardGame> LeaderboardService::LoadGames(std::stop_token stopToken) const
{
    return gateway_.LoadGames(stopToken);
}

domain::LeaderboardTop LeaderboardService::LoadTop(
    std::string_view gameType,
    std::stop_token stopToken) const
{
    return gateway_.LoadTop(gameType, stopToken);
}
}
