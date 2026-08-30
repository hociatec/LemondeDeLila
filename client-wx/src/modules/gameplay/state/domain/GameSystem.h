#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <unordered_map>
#include <vector>

#include <nlohmann/json.hpp>

namespace lila::modules::gameplay::domain
{
struct GameMatchResult final
{
    std::vector<int> winnerPlayerIds;
    std::string reason;
    std::vector<std::vector<int>> ranking;
};

struct GameMatch final
{
    std::string status;
    std::optional<std::int64_t> startedAtMs;
    std::optional<std::int64_t> finishedAtMs;
    std::optional<GameMatchResult> result;
    std::unordered_map<int, std::string> playerStatuses;
};

struct GameRound final
{
    int number = 0;
    std::string status;
    std::optional<int> starterPlayerId;
    std::vector<int> participantPlayerIds;
    std::vector<int> leftPlayerIds;
    std::vector<int> winnerPlayerIds;
    int completedRounds = 0;
};

struct GameTurn final
{
    std::optional<int> currentPlayerId;
    int direction = 1;
    int number = 0;
    std::optional<int> actionPointsRemaining;
    int immediateExtraTurns = 0;
    int extraCount = 0;
    std::unordered_map<int, int> skipTurnsByPlayer;
    std::unordered_map<int, int> extraTurnsByPlayer;
    std::unordered_map<int, int> replacementTurnsByPlayer;
    std::string waitingSessionId;
    std::vector<int> waitingPlayerIds;
};

struct GamePlayer final
{
    int id = 0;
    std::string username;
    bool isBot = false;
    bool alive = true;
};

struct GameSetup final
{
    bool complete = false;
    std::string phase;
    std::optional<int> ownerPlayerId;
    nlohmann::json values = nlohmann::json::object();
};

struct GameEngineEvent final
{
    std::string id;
    std::string type;
    nlohmann::json data = nlohmann::json::object();
    std::optional<int> actorId;
    std::int64_t occurredAtMs = 0;
    std::optional<std::int64_t> sequence;

    [[nodiscard]] std::string Identity() const;
};

struct GameSystem final
{
    GameMatch match;
    GameRound round;
    GameTurn turn;
    std::vector<GamePlayer> players;
    GameSetup setup;
    std::vector<GameEngineEvent> events;
};
}
