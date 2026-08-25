#pragma once

#include "modules/gameplay/state/domain/GameState.h"

namespace lila::modules::gameplay::application
{
class GameStateUpdatePolicy final
{
public:
    [[nodiscard]] static bool ShouldApply(
        const domain::GameState& current,
        const domain::GameState& incoming) noexcept
    {
        if (current.roomId <= 0 || incoming.roomId != current.roomId ||
            incoming.gameType != current.gameType)
            return true;
        if (current.version <= 0 || incoming.version <= 0) return true;
        return incoming.version >= current.version;
    }
};
}
