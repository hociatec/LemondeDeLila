#include "modules/gameplay/cards/application/GameCardActionResolver.h"

#include <array>
#include <string>
#include <string_view>

#include "shared/data/json/JsonCoercion.h"

namespace lila::modules::gameplay::application::cards
{
namespace
{
bool TargetsCard(const domain::GameAction& action, const std::string& cardId)
{
    if (!action.payload.is_object() || cardId.empty()) return false;
    static constexpr std::array<std::string_view, 5> keys{
        "cardId", "memberId", "card", "id", "value"};
    for (const auto key : keys)
    {
        const auto found = action.payload.find(std::string(key));
        if (found != action.payload.end() &&
            lila::shared::data::json::ScalarText(*found) == cardId)
            return true;
    }
    return false;
}
}

std::optional<std::size_t> GameCardActionResolver::ResolveIndex(
    const std::vector<domain::GameCard>& cards,
    const std::vector<domain::GameAction>& actions,
    std::size_t selectedCard)
{
    if (selectedCard >= cards.size()) return std::nullopt;
    const auto& card = cards[selectedCard];

    if (card.actionIndex.has_value())
    {
        const auto index = *card.actionIndex;
        if (index < actions.size() && !actions[index].disabled) return index;
    }

    // When the server explicitly marks a card as disabled and doesn't bind an
    // action index, it is display-only. Do not mistake another action targeting
    // the same card (for example an inspection action) for its primary action.
    if (card.disabled) return std::nullopt;

    for (std::size_t index = 0; index < actions.size(); ++index)
    {
        const auto& action = actions[index];
        if (action.disabled || !TargetsCard(action, card.id)) continue;
        // Identical cards are interchangeable unless the server supplied an
        // explicit actionIndex. A single enumerated action therefore applies
        // to every copy of the same card in the hand.
        return index;
    }
    return std::nullopt;
}

std::optional<domain::GameAction> GameCardActionResolver::Resolve(
    const std::vector<domain::GameCard>& cards,
    const std::vector<domain::GameAction>& actions,
    std::size_t selectedCard)
{
    const auto index = ResolveIndex(cards, actions, selectedCard);
    return index.has_value()
        ? std::optional<domain::GameAction>(actions[*index])
        : std::nullopt;
}
}
