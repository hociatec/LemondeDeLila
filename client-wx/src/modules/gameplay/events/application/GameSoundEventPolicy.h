#pragma once
#include <algorithm>
#include <string>
#include <vector>
#include "modules/gameplay/state/domain/GameSystem.h"

namespace lila::modules::gameplay::application
{
inline std::string GameSoundEventType(const domain::GameEngineEvent& event,
    const std::vector<domain::GameEngineEvent>& batch, int viewerId)
{
    const auto& data = event.details;
    if (event.type == "quiz.revealed")
    {
        const auto answer = data.answers.find(viewerId);
        if (!data.correctAnswerIndex || answer == data.answers.end()) return {};
        return answer->second == *data.correctAnswerIndex ? "quiz.correct" : "quiz.wrong";
    }
    if (event.type != "game.message") return event.type;
    if (data.semanticKey == "game.grid.wall.placed") return "wall.placed";
    if (data.semanticKey == "game.grid.pawn.moved") return "pawn.placed";
    if (data.semanticKey != "game.quiz.answered" || !data.correct) return {};
    const int player = data.playerId.value_or(event.actorId.value_or(0));
    // A revealed engine quiz already provides the result for this viewer.
    if (!data.quizSessionId.empty() && std::ranges::any_of(batch, [&](const auto& other)
        { return other.type == "quiz.revealed" && other.details.quizSessionId == data.quizSessionId &&
            other.details.answers.contains(player); })) return {};
    return *data.correct ? "quiz.correct" : "quiz.wrong";
}
}
