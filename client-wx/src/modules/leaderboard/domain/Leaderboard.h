#pragma once

#include <string>
#include <vector>

namespace lila::modules::leaderboard::domain
{
struct LeaderboardGame
{
    std::string gameType;
    std::string gameName;
};

struct LeaderboardEntry
{
    int userId = 0;
    std::string username;
    int wins = 0;
    int losses = 0;
    int finished = 0;
    int quit = 0;
};

struct LeaderboardTop
{
    std::string gameType;
    std::vector<LeaderboardEntry> entries;
};
}
