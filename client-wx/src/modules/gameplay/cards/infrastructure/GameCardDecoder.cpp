#include "modules/gameplay/cards/infrastructure/GameCardDecoder.h"

#include <optional>
#include <string_view>

#include <nlohmann/json.hpp>

#include "shared/data/json/JsonCoercion.h"

namespace lila::modules::gameplay::infrastructure
{
namespace
{
std::string FirstText(
    const nlohmann::json& value,
    std::initializer_list<std::string_view> keys)
{
    if (!value.is_object()) return {};
    for (const auto key : keys)
    {
        const auto item = value.find(std::string(key));
        if (item == value.end()) continue;
        auto text = lila::shared::data::json::ScalarText(*item);
        if (!text.empty()) return text;
    }
    return {};
}

std::optional<domain::GameCard> DecodeCard(const nlohmann::json& value)
{
    if (value.is_string() || value.is_number())
    {
        auto text = lila::shared::data::json::ScalarText(value);
        if (text.empty()) return std::nullopt;
        return domain::GameCard{
            text, std::move(text), {}, {}, {}, false, std::nullopt};
    }
    if (!value.is_object()) return std::nullopt;

    auto id = FirstText(value, {"id", "cardId", "memberId", "key", "value"});
    auto label = FirstText(value, {"label", "name", "title", "card", "value"});
    auto description = FirstText(value, {"description", "detail", "text"});
    auto family = FirstText(value, {"family", "familyId"});
    auto color = FirstText(value, {"color", "colour"});
    const bool disabled = value.value("disabled", false);
    std::optional<std::size_t> actionIndex;
    const auto action = value.find("actionIndex");
    if (action != value.end() && action->is_number_unsigned())
        actionIndex = action->get<std::size_t>();
    else if (action != value.end() && action->is_number_integer() && action->get<long long>() >= 0)
        actionIndex = static_cast<std::size_t>(action->get<long long>());
    if (label.empty()) label = id;
    if (id.empty()) id = label;
    if (label.empty()) return std::nullopt;
    return domain::GameCard{std::move(id), std::move(label), std::move(description),
        std::move(family), std::move(color), disabled, actionIndex};
}

std::vector<domain::GameCard> DecodeArray(const nlohmann::json& value)
{
    std::vector<domain::GameCard> cards;
    if (!value.is_array()) return cards;
    cards.reserve(value.size());
    for (const auto& item : value)
    {
        auto card = DecodeCard(item);
        if (card.has_value()) cards.push_back(std::move(*card));
    }
    return cards;
}
}

std::vector<domain::GameCard> GameCardDecoder::DecodeVisibleHands(const nlohmann::json& cardsKit)
{
    std::vector<domain::GameCard> result;
    if (!cardsKit.is_object()) return result;
    const auto hands = cardsKit.find("hands");
    if (hands == cardsKit.end() || !hands->is_object()) return result;
    for (const auto& hand : hands->items())
    {
        if (!hand.value().is_object()) continue;
        const auto byPlayer = hand.value().find("byPlayer");
        if (byPlayer == hand.value().end() || !byPlayer->is_object()) continue;
        for (const auto& playerCards : byPlayer->items())
        {
            if (!playerCards.value().is_array()) continue;
            auto cards = DecodeArray(playerCards.value());
            result.insert(result.end(),
                std::make_move_iterator(cards.begin()),
                std::make_move_iterator(cards.end()));
        }
    }
    return result;
}
}
