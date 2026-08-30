#include "modules/gameplay/state/infrastructure/GameAssetCapabilitiesDecoder.h"

#include <nlohmann/json.hpp>

#include "modules/gameplay/state/infrastructure/GamePayloadJsonReader.h"

namespace lila::modules::gameplay::infrastructure
{
namespace
{
int PlayerId(const std::string& key)
{
    try { return std::stoi(key); } catch (const std::exception&) { return 0; }
}

std::vector<int> Ids(const nlohmann::json& raw)
{
    std::vector<int> result;
    if (!raw.is_array()) return result;
    for (const auto& value : raw)
        if (value.is_number_integer()) result.push_back(value.get<int>());
    return result;
}
}

std::optional<domain::GameInventoryView> GameAssetCapabilitiesDecoder::Inventory(
    const nlohmann::json& raw)
{
    if (!raw.is_object() || raw.empty()) return std::nullopt;
    domain::GameInventoryView result;
    for (const auto& item : raw.items())
    {
        if (!item.value().is_object()) continue;
        domain::GameInventorySet set;
        set.id = item.key();
        set.visibility = detail::ReadString(item.value(), "visibility");
        const auto byPlayer = item.value().find("byPlayer");
        if (byPlayer != item.value().end() && byPlayer->is_object())
            for (const auto& playerItem : byPlayer->items())
            {
                domain::GameInventoryPlayer player;
                player.playerId = PlayerId(playerItem.key());
                if (playerItem.value().is_array())
                {
                    for (const auto& id : playerItem.value())
                        if (id.is_string()) ++player.quantities[id.get<std::string>()];
                }
                else if (playerItem.value().is_object())
                {
                    const auto count = playerItem.value().find("count");
                    if (count != playerItem.value().end() && count->is_number_integer())
                        player.hiddenCount = count->get<int>();
                }
                set.players.push_back(std::move(player));
            }
        result.sets.push_back(std::move(set));
    }
    return result.sets.empty() ? std::nullopt
                               : std::optional<domain::GameInventoryView>(std::move(result));
}

std::optional<domain::GameEconomyView> GameAssetCapabilitiesDecoder::Economy(
    const nlohmann::json& raw)
{
    if (!raw.is_object() || raw.empty()) return std::nullopt;
    domain::GameEconomyView result;
    for (const auto& item : raw.items())
    {
        if (!item.value().is_object()) continue;
        domain::GameMarketView market;
        market.id = item.key();
        market.currency = detail::ReadString(item.value(), "currency");
        const auto prices = item.value().find("prices");
        if (prices != item.value().end() && prices->is_object())
            for (const auto& price : prices->items())
                if (price.value().is_number())
                    market.prices.push_back({price.key(), price.value().get<double>()});
        result.markets.push_back(std::move(market));
    }
    return result.markets.empty() ? std::nullopt
                                  : std::optional<domain::GameEconomyView>(std::move(result));
}

std::optional<domain::GameOwnershipView> GameAssetCapabilitiesDecoder::Ownership(
    const nlohmann::json& raw)
{
    if (!raw.is_object() || raw.empty()) return std::nullopt;
    domain::GameOwnershipView result;
    for (const auto& registry : raw.items())
    {
        if (!registry.value().is_object()) continue;
        const auto owners = registry.value().find("owners");
        if (owners == registry.value().end() || !owners->is_object()) continue;
        for (const auto& asset : owners->items())
            result.assets.push_back({registry.key(), asset.key(), Ids(asset.value())});
    }
    return result.assets.empty() ? std::nullopt
                                 : std::optional<domain::GameOwnershipView>(std::move(result));
}

std::optional<domain::GameCollectionsView> GameAssetCapabilitiesDecoder::Collections(
    const nlohmann::json& raw)
{
    if (!raw.is_object() || raw.empty()) return std::nullopt;
    domain::GameCollectionsView result;
    for (const auto& collection : raw.items())
    {
        if (!collection.value().is_object()) continue;
        const auto byPlayer = collection.value().find("byPlayer");
        if (byPlayer == collection.value().end() || !byPlayer->is_object()) continue;
        for (const auto& playerItem : byPlayer->items())
        {
            if (!playerItem.value().is_object()) continue;
            domain::GamePlayerCollection player;
            player.collectionId = collection.key();
            player.playerId = PlayerId(playerItem.key());
            player.total = detail::ReadInt(playerItem.value(), "total");
            const auto groups = playerItem.value().find("groups");
            if (groups != playerItem.value().end() && groups->is_object())
                for (const auto& groupItem : groups->items())
                {
                    if (!groupItem.value().is_object()) continue;
                    domain::GameCollectionGroup group;
                    group.id = groupItem.key();
                    group.count = detail::ReadInt(groupItem.value(), "count");
                    const auto items = groupItem.value().find("items");
                    if (items != groupItem.value().end() && items->is_array())
                        for (const auto& id : *items)
                            if (id.is_string()) group.items.push_back(id.get<std::string>());
                    player.groups.push_back(std::move(group));
                }
            result.players.push_back(std::move(player));
        }
    }
    return result.players.empty() ? std::nullopt
                                  : std::optional<domain::GameCollectionsView>(std::move(result));
}
}
