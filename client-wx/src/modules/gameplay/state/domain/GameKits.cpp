#include "modules/gameplay/state/domain/GameKits.h"

namespace lila::modules::gameplay::domain
{
const std::vector<GameCard>& GameKits::VisibleHand() const noexcept
{
    static const std::vector<GameCard> empty;
    return cards ? cards->visibleHand : empty;
}

const GameDiceState* GameKits::Dice() const noexcept
{
    return dice ? &*dice : nullptr;
}

const GameValue* GameKits::Unknown(const std::string& capability) const
{
    const auto found = unknownCapabilities.find(capability);
    return found == unknownCapabilities.end() ? nullptr : &found->second;
}

bool GameKits::Has(const std::string& capability) const
{
    if (capability == "cards") return cards.has_value();
    if (capability == "dice") return dice.has_value();
    if (capability == "grid") return grid.has_value();
    if (capability == "movement") return movement.has_value();
    if (capability == "pawns") return pawns.has_value();
    if (capability == "score" || capability == "scores") return score.has_value();
    if (capability == "resources") return resources.has_value();
    if (capability == "counters") return counters.has_value();
    if (capability == "status") return status.has_value();
    if (capability == "inventory") return inventory.has_value();
    if (capability == "economy") return economy.has_value();
    if (capability == "ownership") return ownership.has_value();
    if (capability == "collections") return collections.has_value();
    if (capability == "quiz") return quiz.has_value();
    if (capability == "submissions") return submissions.has_value();
    return Unknown(capability) != nullptr;
}
}
