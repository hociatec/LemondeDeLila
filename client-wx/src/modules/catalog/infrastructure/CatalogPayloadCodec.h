#pragma once

#include <nlohmann/json_fwd.hpp>

#include "modules/catalog/domain/CatalogSnapshot.h"

namespace lila::modules::catalog::infrastructure::codec
{
[[nodiscard]] domain::CatalogSnapshot ReadCatalogPayload(const nlohmann::json& payload);
}
