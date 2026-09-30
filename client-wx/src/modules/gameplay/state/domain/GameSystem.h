#pragma once

#include <cstdint>
#include <map>
#include <optional>
#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>

#include "modules/gameplay/state/domain/GameValue.h"
#include "modules/gameplay/shortcuts/domain/GameShortcut.h"

namespace lila::modules::gameplay::domain
{
enum class GameMatchStatus
{
    Unknown,
    Waiting,
    Setup,
    Playing,
    Finished,
    Cancelled,
};

[[nodiscard]] constexpr bool IsActive(GameMatchStatus status) noexcept
{
    return status == GameMatchStatus::Playing;
}

[[nodiscard]] constexpr std::string_view MatchStatusId(GameMatchStatus status) noexcept
{
    switch (status)
    {
    case GameMatchStatus::Waiting: return "waiting";
    case GameMatchStatus::Setup: return "setup";
    case GameMatchStatus::Playing: return "playing";
    case GameMatchStatus::Finished: return "finished";
    case GameMatchStatus::Cancelled: return "cancelled";
    case GameMatchStatus::Unknown: return "unknown";
    }
    return "unknown";
}

struct GameMatchResult final
{
    std::vector<int> winnerPlayerIds;
    std::string reason;
    std::vector<std::vector<int>> ranking;
};

struct GameMatch final
{
    GameMatchStatus status = GameMatchStatus::Unknown;
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

// Engine phases are declared by each game and therefore remain extensible.
// Wrapping the identifier prevents presentation code from treating it as a
// closed lifecycle state or branching on concrete phase literals.
struct GamePhaseId final
{
    std::string value;
};

struct GameSetup final
{
    bool complete = false;
    GamePhaseId phase;
    std::optional<int> ownerPlayerId;
    std::map<std::string, GameValue> values;
};

struct GameEngineEventData final
{
    bool announce = true;
    std::string message;
    std::string content;
    std::string deckId;
    std::string resourceId;
    std::string itemId;
    std::string pawnId;
    std::string total;
    std::string value;
    std::string amount;
    std::string fromPosition;
    std::string toPosition;
    std::string position;
    std::string number;
    std::string count;
    std::optional<int> playerId;
    std::optional<int> sourcePlayerId;
    std::optional<int> targetPlayerId;
    std::optional<int> leftPlayerId;
    std::optional<int> rightPlayerId;
};

struct GameEngineEvent final
{
    std::string id;
    std::string type;
    std::string soundSemantic;
    GameEngineEventData details;
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
    std::vector<GameShortcut> shortcuts;
};
}
