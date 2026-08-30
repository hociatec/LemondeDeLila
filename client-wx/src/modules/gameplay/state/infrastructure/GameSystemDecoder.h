#pragma once

#include <nlohmann/json_fwd.hpp>

#include "modules/gameplay/state/domain/GameSystem.h"

namespace lila::modules::gameplay::infrastructure
{
class GameSystemDecoder final
{
public:
    [[nodiscard]] static domain::GameSystem Decode(const nlohmann::json& system);
};
}
