#pragma once

#include <nlohmann/json_fwd.hpp>

#include "modules/gameplay/session/domain/GameEvent.h"

namespace lila::modules::gameplay::infrastructure
{
class GameEventPayloadCodec final
{
public:
    [[nodiscard]] static domain::GameEvent Decode(const nlohmann::json& message);
};
}
