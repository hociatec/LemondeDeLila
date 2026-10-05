#pragma once

#include <string>

#include "modules/gameplay/cards/domain/GameCard.h"

namespace lila::modules::gameplay::application::cards
{
class GameCardTextBuilder final
{
public:
    [[nodiscard]] static std::string ListText(const domain::GameCard& card);
    [[nodiscard]] static std::string DescriptionText(const domain::GameCard& card);
};
}
