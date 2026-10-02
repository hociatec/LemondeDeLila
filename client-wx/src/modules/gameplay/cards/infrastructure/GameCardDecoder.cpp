#include "modules/gameplay/cards/infrastructure/GameCardDecoder.h"

#include <algorithm>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>

#include <nlohmann/json.hpp>

#include "shared/data/json/JsonCoercion.h"
#include "shared/data/application/IntegerText.h"

namespace lila::modules::gameplay::infrastructure
{
namespace
{
constexpr std::size_t MaximumCardCollections = 64;
constexpr std::size_t MaximumCardsPerCollection = 1'024;
constexpr std::size_t MaximumVisibleCards = 4'096;

void EnsureCollectionLimit(const nlohmann::json& value, const char* name)
{
    if (value.size() > MaximumCardCollections)
        throw std::runtime_error(std::string("Trop de collections de cartes: ") + name + ".");
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
    if (value.size() > MaximumCardsPerCollection)
        throw std::runtime_error("Trop de cartes dans une collection gameplay.");
    cards.reserve(value.size());
    for (const auto& item : value)
    {
        auto card = DecodeCard(item);
        if (card.has_value()) cards.push_back(std::move(*card));
    }
    return cards;
}

int Count(const nlohmann::json& value)
{
    if (value.is_array()) return static_cast<int>(value.size());
    if (!value.is_object()) return 0;
    const auto count = value.find("count");
    return count != value.end() && count->is_number_integer()
        ? std::max(0, count->get<int>()) : 0;
}
}

domain::GameCardsView GameCardDecoder::Decode(const nlohmann::json& cardsKit)
{
    domain::GameCardsView result;
    if (!cardsKit.is_object())
        throw std::runtime_error("Capability cards invalide: objet attendu.");

    const auto decks = cardsKit.find("decks");
    if (decks != cardsKit.end() && decks->is_object())
    {
        EnsureCollectionLimit(*decks, "decks");
        for (const auto& item : decks->items())
            result.decks.push_back({item.key(), Count(item.value())});
    }

    const auto discards = cardsKit.find("discards");
    if (discards != cardsKit.end() && discards->is_object())
    {
        EnsureCollectionLimit(*discards, "discards");
        for (const auto& item : discards->items())
        {
            domain::GameDiscardView discard;
            discard.id = item.key();
            if (item.value().is_object())
            {
                const auto cards = item.value().find("cards");
                if (cards != item.value().end()) discard.cards = DecodeArray(*cards);
            }
            discard.count = Count(item.value());
            if (discard.count == 0) discard.count = static_cast<int>(discard.cards.size());
            result.discards.push_back(std::move(discard));
        }
    }

    const auto hands = cardsKit.find("hands");
    if (hands != cardsKit.end() && !hands->is_object())
        throw std::runtime_error("Capability cards invalide: hands doit etre un objet.");
    if (hands != cardsKit.end() && hands->is_object())
    {
        EnsureCollectionLimit(*hands, "hands");
        for (const auto& item : hands->items())
        {
            if (!item.value().is_object())
                throw std::runtime_error("Capability cards invalide: main non objet.");
            domain::GameHandView hand;
            hand.id = item.key();
            hand.visibility = FirstText(item.value(), {"visibility"});
            const auto byPlayer = item.value().find("byPlayer");
            if (byPlayer != item.value().end() && !byPlayer->is_object())
                throw std::runtime_error("Capability cards invalide: byPlayer doit etre un objet.");
            if (byPlayer != item.value().end() && byPlayer->is_object())
            {
                if (byPlayer->size() > 128)
                    throw std::runtime_error("Trop de mains joueur gameplay.");
                for (const auto& playerItem : byPlayer->items())
                {
                    const auto playerId = lila::shared::data::ParseInteger(playerItem.key());
                    if (!playerId || *playerId == 0) continue;
                    domain::GameHandPlayerView player;
                    player.playerId = *playerId;
                    player.cardsVisible = playerItem.value().is_array();
                    player.cards = DecodeArray(playerItem.value());
                    player.count = player.cardsVisible
                        ? static_cast<int>(player.cards.size()) : Count(playerItem.value());
                    if (player.cardsVisible)
                    {
                        if (result.visibleHand.size() + player.cards.size() > MaximumVisibleCards)
                            throw std::runtime_error("Trop de cartes visibles gameplay.");
                        result.visibleHand.insert(result.visibleHand.end(),
                            player.cards.begin(), player.cards.end());
                    }
                    hand.players.push_back(std::move(player));
                }
            }
            result.hands.push_back(std::move(hand));
        }
    }

    const auto zones = cardsKit.find("zones");
    if (zones != cardsKit.end() && zones->is_object())
    {
        EnsureCollectionLimit(*zones, "zones");
        for (const auto& item : zones->items())
        {
            if (!item.value().is_object()) continue;
            domain::GameCardZoneView zone;
            zone.id = item.key();
            zone.visibility = FirstText(item.value(), {"visibility"});
            const auto cards = item.value().find("cards");
            if (cards != item.value().end())
            {
                zone.cardsVisible = cards->is_array();
                zone.cards = DecodeArray(*cards);
                zone.count = zone.cardsVisible
                    ? static_cast<int>(zone.cards.size()) : Count(*cards);
            }
            result.zones.push_back(std::move(zone));
        }
    }
    return result;
}

}
