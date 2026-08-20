#pragma once

#include <nlohmann/json.hpp>

namespace lila::modules::options::infrastructure::json
{
[[nodiscard]] nlohmann::json MigrateToCurrentSchema(const nlohmann::json& document);
}
