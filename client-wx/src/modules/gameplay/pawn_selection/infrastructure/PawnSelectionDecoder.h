#pragma once

#include <optional>
#include <vector>

#include <nlohmann/json.hpp>

#include "modules/gameplay/actions/domain/GameAction.h"
#include "modules/gameplay/pawn_selection/domain/PawnSelection.h"

namespace lila::modules::gameplay::infrastructure
{
class PawnSelectionDecoder final
{
public:
    [[nodiscard]] static std::optional<domain::PawnSelection> Decode(
        const nlohmann::json& stateNode,
        const std::vector<domain::GameAction>& availableActions,
        const nlohmann::json& pawnsKit = nlohmann::json::object());
};
}
