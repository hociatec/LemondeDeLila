#include "modules/gameplay/cards/application/GameCardActionResolver.h"

#include <array>
#include <string>
#include <string_view>

namespace lila::modules::gameplay::application::cards
{
namespace
{
std::string ScalarText(const nlohmann::json& value)
{
    if (value.is_string()) return value.get<std::string>();
    if (value.is_number_integer()) return std::to_string(value.get<long long>());
    if (value.is_number_unsigned()) return std::to_string(value.get<unsigned long long>());
    if (value.is_number_float()) return std::to_string(value.get<double>());
    return {};
}

bool TargetsCard(const domain::GameAction& action, const std::string& cardId)
{
    if (!action.payload.is_object() || cardId.empty()) return false;
    static constexpr std::array<std::string_view, 5> keys{
        "cardId", "memberId", "card", "id", "value"};
    for (const auto key : keys)
    {
        const auto found = action.payload.find(std::string(key));
        if (found != action.payload.end() && ScalarText(*found) == cardId) return true;
    }
    return false;
}
}

std::optional<domain::GameAction> GameCardActionResolver::Resolve(
    const std::vector<domain::GameCard>& cards,
    const std::vector<domain::GameAction>& actions,
    std::size_t selectedCard)
{
    if (selectedCard >= cards.size()) return std::nullopt;
    const auto& card = cards[selectedCard];
    if (card.disabled) return std::nullopt;

    if (card.actionIndex.has_value())
    {
        const auto index = *card.actionIndex;
        if (index >= actions.size() || actions[index].disabled) return std::nullopt;
        return actions[index];
    }

    std::size_t occurrence = 0;
    for (std::size_t index = 0; index < selectedCard; ++index)
        if (cards[index].id == card.id) ++occurrence;

    for (const auto& action : actions)
    {
        if (action.disabled || !TargetsCard(action, card.id)) continue;
        if (occurrence-- == 0) return action;
    }
    return std::nullopt;
}
}
