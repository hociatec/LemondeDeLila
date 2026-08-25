#include "modules/gameplay/cards/application/GameCardTextBuilder.h"

namespace lila::modules::gameplay::application::cards
{
std::string GameCardTextBuilder::AccessibleText(const domain::GameCard& card)
{
    if (card.description.empty() || card.label.find(card.description) != std::string::npos)
        return card.label;
    return card.label + ". " + card.description;
}
}
