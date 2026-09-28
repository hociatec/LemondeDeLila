#pragma once

#include <map>
#include <optional>
#include <string>
#include <vector>

#include "modules/gameplay/state/domain/GamePlayerValueCapabilities.h"

namespace lila::modules::gameplay::domain
{
struct GameInventoryPlayer final
{
    int playerId = 0;
    std::map<std::string, int> quantities;
    std::optional<int> hiddenCount;
};
struct GameInventorySet final
{
    std::string id;
    std::string visibility;
    std::vector<GameInventoryPlayer> players;
};
struct GameInventoryView final { std::vector<GameInventorySet> sets; };
struct GameMarketView final
{
    std::string id;
    std::string currency;
    std::vector<GameNamedAmount> prices;
};
struct GameEconomyView final { std::vector<GameMarketView> markets; };
struct GameOwnedAsset final
{
    std::string registryId;
    std::string assetId;
    std::vector<int> ownerIds;
};
struct GameOwnershipView final { std::vector<GameOwnedAsset> assets; };
struct GameCollectionGroup final
{
    std::string id;
    int count = 0;
    std::vector<std::string> items;
};
struct GamePlayerCollection final
{
    std::string collectionId;
    int playerId = 0;
    int total = 0;
    std::vector<GameCollectionGroup> groups;
};
struct GameCollectionsView final { std::vector<GamePlayerCollection> players; };
}
