#pragma once

#include <vector>

#include <nlohmann/json_fwd.hpp>

#include "modules/catalog/domain/CatalogShelf.h"

namespace lila::modules::catalog::infrastructure::codec
{
[[nodiscard]] std::vector<domain::CatalogShelf> ReadShelvesPayload(const nlohmann::json& payload);
}
