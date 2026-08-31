#pragma once

#include <nlohmann/json_fwd.hpp>

#include "modules/gameplay/state/domain/GameCapabilities.h"

namespace lila::modules::gameplay::infrastructure
{
class GameCardDecoder final
{
public:
    [[nodiscard]] static domain::GameCardsView Decode(
        const nlohmann::json& cardsKit);
};
}
