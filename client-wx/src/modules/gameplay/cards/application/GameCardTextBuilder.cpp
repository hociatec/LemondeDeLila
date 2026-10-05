#include "modules/gameplay/cards/application/GameCardTextBuilder.h"

namespace lila::modules::gameplay::application::cards
{
std::string GameCardTextBuilder::ListText(const domain::GameCard& card)
{
    return card.label;
}

std::string GameCardTextBuilder::DescriptionText(const domain::GameCard& card)
{
    return card.description.empty()
        ? "Aucune description disponible pour cette carte."
        : card.description;
}
}
