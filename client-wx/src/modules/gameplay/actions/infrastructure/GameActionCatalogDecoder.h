#pragma once

#include <vector>

#include <nlohmann/json_fwd.hpp>

#include "modules/gameplay/actions/domain/GameActionDescriptor.h"

namespace lila::modules::gameplay::infrastructure
{
struct GameActionCatalogDecoder final
{
    static std::vector<domain::GameActionDescriptor> Decode(const nlohmann::json& raw);
};
}
