#include "modules/gameplay/cards/infrastructure/GameCardDecoder.h"

#include <optional>
#include <string_view>

#include <nlohmann/json.hpp>

namespace lila::modules::gameplay::infrastructure
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

std::string FirstText(
    const nlohmann::json& value,
    std::initializer_list<std::string_view> keys)
{
    if (!value.is_object()) return {};
    for (const auto key : keys)
    {
        const auto item = value.find(std::string(key));
        if (item == value.end()) continue;
        auto text = ScalarText(*item);
        if (!text.empty()) return text;
    }
    return {};
}

std::optional<domain::GameCard> DecodeCard(const nlohmann::json& value)
{
    if (value.is_string() || value.is_number())
    {
        auto text = ScalarText(value);
        if (text.empty()) return std::nullopt;
        return domain::GameCard{text, std::move(text)};
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

std::vector<domain::GameCard> GameCardDecoder::DecodeHand(const nlohmann::json& extras)
{
    if (!extras.is_object()) return {};
    return DecodeArray(extras.value("hand", nlohmann::json::array()));
}
}
