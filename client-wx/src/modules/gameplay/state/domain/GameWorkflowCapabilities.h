#pragma once

#include <cstdint>
#include <map>
#include <optional>
#include <string>
#include <vector>

namespace lila::modules::gameplay::domain
{
struct GameQuizBank final { std::string id; int count = 0; int cursor = 0; int remaining = 0; };
struct GameQuizSession final
{
    std::string id;
    std::string questionId;
    std::string bankId;
    std::string phase;
    std::string prompt;
    std::vector<std::string> choices;
    std::vector<int> participantPlayerIds;
    std::vector<int> answeredPlayerIds;
    std::optional<int> myAnswer;
    std::optional<int> correctAnswerIndex;
    bool scored = false;
};
struct GameQuizView final { std::vector<GameQuizBank> banks; std::vector<GameQuizSession> sessions; };
enum class GameSubmissionValueKind { Unknown, Text, Option, Card, Player, Number, Boolean };
struct GameSubmissionValue final
{
    GameSubmissionValueKind kind = GameSubmissionValueKind::Unknown;
    std::string id;
    std::string label;
    std::string text;
    std::optional<int> playerId;
    std::optional<double> number;
    std::optional<bool> boolean;
};
struct GameSubmissionSession final
{
    std::string id;
    std::string kind;
    std::vector<int> participantPlayerIds;
    std::vector<int> submittedPlayerIds;
    std::vector<int> pendingPlayerIds;
    bool closed = false;
    bool revealed = false;
    std::map<int, GameSubmissionValue> visibleValues;
    std::optional<GameSubmissionValue> ownValue;
};
struct GameSubmissionJudge final
{
    std::string id;
    std::optional<int> playerId;
    std::vector<int> playerIds;
    int index = 0;
};
struct GameSubmissionsView final
{
    std::string stage;
    std::vector<GameSubmissionSession> sessions;
    std::vector<GameSubmissionJudge> judges;
};
struct GameEffectView final
{
    std::optional<int> sourcePlayerId;
    std::string sourceCardId;
    std::string sourceDeckId;
    std::string sourceTileId;
    std::string status;
    bool resolved = false;
};
struct GameTimerView final
{
    std::string id;
    std::string label;
    std::string actionType;
    std::optional<std::int64_t> deadlineMs;
    std::optional<std::int64_t> remainingMs;
    bool paused = false;
};
}
