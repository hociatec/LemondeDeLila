#include "modules/gameplay/information/application/GameKnownCapabilityText.h"

#include <cmath>
#include <sstream>

#include "modules/gameplay/information/application/GameValueTextBuilder.h"

namespace lila::modules::gameplay::application::info
{
namespace
{
std::string Player(const domain::GameState& state, int id)
{
    for (const auto& player : state.system.players)
        if (player.id == id) return player.username;
    return "Joueur " + std::to_string(id);
}
}

std::optional<std::string> BuildAssetCapabilityText(
    const domain::GameState& state, const std::string& capability)
{
    std::ostringstream out;
    if (capability == "inventory" && state.kits.inventory)
    {
        for (const auto& set : state.kits.inventory->sets)
            for (const auto& player : set.players)
            {
                out << Player(state, player.playerId) << " — " << HumanLabel(set.id) << '\n';
                if (player.hiddenCount) out << "- " << *player.hiddenCount << " objet(s) masqué(s)\n";
                for (const auto& [item, count] : player.quantities)
                    out << "- " << HumanLabel(item) << " : " << count << '\n';
            }
        return out.str();
    }
    if (capability == "economy" && state.kits.economy)
    {
        for (const auto& market : state.kits.economy->markets)
        {
            out << "Marché " << HumanLabel(market.id);
            if (!market.currency.empty()) out << ", monnaie " << HumanLabel(market.currency);
            out << '\n';
            for (const auto& price : market.prices)
                out << "- " << HumanLabel(price.id) << " : " << price.value << '\n';
        }
        return out.str();
    }
    if (capability == "ownership" && state.kits.ownership)
    {
        for (const auto& asset : state.kits.ownership->assets)
        {
            out << HumanLabel(asset.assetId) << " : ";
            if (asset.ownerIds.empty()) out << "sans propriétaire";
            for (std::size_t index = 0; index < asset.ownerIds.size(); ++index)
            {
                if (index > 0) out << ", ";
                out << Player(state, asset.ownerIds[index]);
            }
            out << '\n';
        }
        return out.str();
    }
    if (capability == "collections" && state.kits.collections)
    {
        for (const auto& collection : state.kits.collections->players)
        {
            out << Player(state, collection.playerId) << " — "
                << HumanLabel(collection.collectionId) << ", total " << collection.total << '\n';
            for (const auto& group : collection.groups)
                out << "- " << HumanLabel(group.id) << " : " << group.count << '\n';
        }
        return out.str();
    }
    return std::nullopt;
}
}
