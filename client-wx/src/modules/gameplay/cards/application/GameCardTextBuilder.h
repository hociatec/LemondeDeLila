#pragma once

#include <string>

#include "modules/gameplay/cards/domain/GameCard.h"

namespace lila::modules::gameplay::application::cards
{
class GameCardTextBuilder final
{
public:
    [[nodiscard]] static std::string AccessibleText(const domain::GameCard& card);
};
}
