#pragma once

#include <optional>

#include <nlohmann/json_fwd.hpp>

#include "modules/gameplay/state/domain/GameCapabilities.h"

namespace lila::modules::gameplay::infrastructure
{
struct GameAssetCapabilitiesDecoder final
{
    static std::optional<domain::GameInventoryView> Inventory(const nlohmann::json& raw);
    static std::optional<domain::GameEconomyView> Economy(const nlohmann::json& raw);
    static std::optional<domain::GameOwnershipView> Ownership(const nlohmann::json& raw);
    static std::optional<domain::GameCollectionsView> Collections(const nlohmann::json& raw);
};
}
