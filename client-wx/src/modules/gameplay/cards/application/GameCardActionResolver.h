#pragma once

#include <cstddef>
#include <optional>
#include <vector>

#include "modules/gameplay/actions/domain/GameAction.h"
#include "modules/gameplay/cards/domain/GameCard.h"

namespace lila::modules::gameplay::application::cards
{
class GameCardActionResolver final
{
public:
    [[nodiscard]] static std::optional<std::size_t> ResolveIndex(
        const std::vector<domain::GameCard>& cards,
        const std::vector<domain::GameAction>& actions,
        std::size_t selectedCard);
    [[nodiscard]] static std::optional<domain::GameAction> Resolve(
        const std::vector<domain::GameCard>& cards,
        const std::vector<domain::GameAction>& actions,
        std::size_t selectedCard);
};
}
