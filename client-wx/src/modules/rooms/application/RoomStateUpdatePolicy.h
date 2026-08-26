#pragma once

#include "modules/rooms/domain/Room.h"

namespace lila::modules::rooms::application
{
class RoomStateUpdatePolicy final
{
public:
    [[nodiscard]] static bool ShouldApply(
        const domain::RoomState& current,
        const domain::RoomState& incoming) noexcept
    {
        if (current.id <= 0 || incoming.id != current.id) return true;

        // Starting a room increments runId. A delayed setup snapshot from the
        // preceding run must never demote an already started game. A real reset
        // keeps the current runId, so it remains applicable.
        if (current.runId > 0 && incoming.runId > 0 &&
            incoming.runId < current.runId)
            return false;

        return true;
    }
};
}
