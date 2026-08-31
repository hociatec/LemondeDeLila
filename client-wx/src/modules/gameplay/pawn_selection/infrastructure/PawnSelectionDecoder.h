#pragma once

#include <optional>

#include "modules/gameplay/pawn_selection/domain/PawnSelection.h"
#include "modules/gameplay/state/domain/GamePending.h"

namespace lila::modules::gameplay::infrastructure
{
class PawnSelectionDecoder final
{
public:
    [[nodiscard]] static std::optional<domain::PawnSelection> Decode(
        const std::optional<domain::GamePending>& pending);
};
}
