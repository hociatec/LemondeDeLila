#include "modules/gameplay/dice/application/GameDiceRollTracker.h"

namespace lila::modules::gameplay::application::dice
{
bool GameDiceRollTracker::Observe(
    const std::optional<domain::GameDiceState>& state,
    int turnIndex)
{
    std::string next;
    if (state && state->total.has_value())
        next = !state->rollKey.empty()
            ? state->rollKey
            : std::to_string(turnIndex) + ":" + std::to_string(*state->total);

    if (!primed_)
    {
        primed_ = true;
        signature_ = std::move(next);
        return false;
    }
    const bool changed = !next.empty() && next != signature_;
    signature_ = std::move(next);
    return changed;
}

void GameDiceRollTracker::Reset()
{
    primed_ = false;
    signature_.clear();
}
}
