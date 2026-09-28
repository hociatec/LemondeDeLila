#pragma once

#include <map>
#include <optional>
#include <string>
#include <vector>

namespace lila::modules::gameplay::domain
{
struct GameScoreEntry final { int playerId = 0; double score = 0; int rank = 0; };
struct GameScoreView final
{
    std::string label = "Scores";
    std::string unitSingular = "point";
    std::string unitPlural = "points";
    std::map<int, double> byPlayer;
    std::vector<GameScoreEntry> leaderboard;
    [[nodiscard]] const std::string& UnitFor(double value) const noexcept
    { return value == 1.0 ? unitSingular : unitPlural; }
};
struct GameNamedAmount final { std::string id; double value = 0; };
struct GamePlayerAmounts final { int playerId = 0; std::vector<GameNamedAmount> values; };
struct GameResourcesView final { std::vector<GamePlayerAmounts> players; };
struct GameCountersView final { std::vector<GameNamedAmount> values; };
struct GameStatusValue final
{
    std::string id;
    int playerId = 0;
    std::optional<int> remaining;
    std::string scope;
};
struct GameStatusView final { std::vector<GameStatusValue> values; };
}
