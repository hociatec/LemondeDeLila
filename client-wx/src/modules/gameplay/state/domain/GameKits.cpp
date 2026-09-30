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
    return availableCapabilities.contains(capability);
}
}
