#pragma once

#include <vector>

#include <nlohmann/json_fwd.hpp>

#include "modules/gameplay/cards/domain/GameCard.h"

namespace lila::modules::gameplay::infrastructure
{
class GameCardDecoder final
{
public:
    [[nodiscard]] static std::vector<domain::GameCard> DecodeVisibleHands(
        const nlohmann::json& cardsKit);
};
}
