#pragma once

#include <vector>

#include "modules/gameplay/state/domain/GameLine.h"
#include "modules/gameplay/state/domain/GameState.h"

namespace lila::modules::gameplay::application
{
class GameActionPresentationPolicy final
{
public:
    [[nodiscard]] static std::vector<domain::GameLine> GenericLines(
        const domain::GameState& state);
};
}
