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

        // Once a stream is versioned, an unidentified snapshot cannot replace it.
        if ((current.runId > 0 && incoming.runId <= 0) ||
            (current.version > 0 && incoming.version <= 0))
            return false;

        if (current.runId > 0 && incoming.runId > 0 &&
            incoming.runId != current.runId)
            return incoming.runId > current.runId;

        // Resetting a room reserves the following run identifier. Therefore a
        // setup projection in the same run as an active game can only be a
        // delayed or corrupted snapshot, even when it carries a newer storage
        // version. Never let it erase the playable surface already displayed.
        if (domain::IsActive(current.system.match.status) &&
            incoming.system.match.status == domain::GameMatchStatus::Setup)
            return false;

        if (current.version <= 0 || incoming.version <= 0) return true;
        return incoming.version > current.version;
    }
};
}
