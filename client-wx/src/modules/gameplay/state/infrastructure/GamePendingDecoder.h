#pragma once

#include <optional>

#include <nlohmann/json.hpp>

#include "modules/gameplay/state/domain/GamePending.h"

namespace lila::modules::gameplay::infrastructure
{
class GamePendingDecoder final
{
public:
    [[nodiscard]] static std::optional<domain::GamePending> Decode(
        const nlohmann::json& pendingNode,
        const std::vector<domain::GameAction>& actions);
};
}
