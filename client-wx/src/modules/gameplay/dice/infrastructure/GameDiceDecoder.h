#pragma once

#include <optional>

#include <nlohmann/json_fwd.hpp>

#include "modules/gameplay/dice/domain/GameDiceState.h"

namespace lila::modules::gameplay::infrastructure
{
class GameDiceDecoder final
{
public:
    [[nodiscard]] static std::optional<domain::GameDiceState> Decode(
        const nlohmann::json& extras);
};
}
