#pragma once

#include <algorithm>
#include <optional>
#include <string_view>
#include <vector>

#include "modules/audio/domain/SoundCue.h"

namespace lila::modules::rooms::application
{
inline std::optional<audio::domain::SoundCue> ResolveGameSound(
    std::string_view type, int playerId, int selfId, const std::vector<int>& winners)
{
    using audio::domain::SoundCue;
    const bool self = selfId != 0 && playerId == selfId;
    if (type == "dice.rolled") return SoundCue::DiceRolled;
    if (type == "card.drawn") return SoundCue::DrawCard;
    if (type == "quiz.correct") return SoundCue::QuizCorrect;
    if (type == "quiz.wrong") return SoundCue::QuizWrong;
    if (type == "round.ended") return SoundCue::RoundEnded;
    if (type == "pawn.picked" || type == "pawn.assigned") return SoundCue::PawnPicked;
    if (type == "pawn.placed" || type.ends_with(".mark.placed"))
        return self ? SoundCue::PawnPlacedSelf : SoundCue::PawnPlacedOpponent;
    if (type == "wall.placed")
        return self ? SoundCue::WallPlacedSelf : SoundCue::WallPlacedOpponent;
    if (type == "match.finished" || type == "game.finished")
    {
        if (winners.empty()) return SoundCue::RoundEnded;
        return std::find(winners.begin(), winners.end(), selfId) != winners.end()
            ? SoundCue::GameVictory : SoundCue::GameDefeat;
    }
    return std::nullopt;
}
}
