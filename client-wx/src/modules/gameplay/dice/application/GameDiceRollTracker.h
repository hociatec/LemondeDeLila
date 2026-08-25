#pragma once

#include <optional>
#include <string>

#include "modules/gameplay/dice/domain/GameDiceState.h"

namespace lila::modules::gameplay::application::dice
{
class GameDiceRollTracker final
{
public:
    [[nodiscard]] bool Observe(const std::optional<domain::GameDiceState>& state, int turnIndex);
    void Reset();

private:
    bool primed_ = false;
    std::string signature_;
};
}
