#pragma once

#include <nlohmann/json_fwd.hpp>

namespace lila::modules::admin::infrastructure
{
[[nodiscard]] nlohmann::json ValidateAndNormalizeAdminPayload(
    const nlohmann::json& payload);
}
