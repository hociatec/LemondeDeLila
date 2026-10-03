#pragma once

#include <vector>

#include "modules/gameplay/state/domain/GameState.h"

namespace lila::modules::gameplay::application
{
struct GameSurfaceAvailability final
{
    bool cards = false;
    bool quiz = false;
    bool pending = false;
    bool board = false;
};

class GameSurfaceSelectors final
{
public:
    [[nodiscard]] static const std::vector<domain::GameCard>& VisibleHand(
        const domain::GameState& state) noexcept
    {
        return state.kits.VisibleHand();
    }

    [[nodiscard]] static const domain::GamePending* PendingDecision(
        const domain::GameState& state) noexcept
    {
        return state.pending ? &*state.pending : nullptr;
    }

    [[nodiscard]] static const domain::GameQuizSession* ActiveQuizSession(
        const domain::GameState& state) noexcept
    {
        if (!state.kits.quiz) return nullptr;
        for (const auto& session : state.kits.quiz->sessions)
            if ((session.phase == "question" || session.phase == "answering") &&
                !session.prompt.empty() && !session.choices.empty())
                return &session;
        return nullptr;
    }

    [[nodiscard]] static GameSurfaceAvailability Available(
        const domain::GameState& state) noexcept
    {
        return {
            !VisibleHand(state).empty(),
            ActiveQuizSession(state) != nullptr,
            PendingDecision(state) != nullptr,
            state.kits.grid && !state.kits.grid->boards.empty(),
        };
    }
};
}
