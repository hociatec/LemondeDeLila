#pragma once

#include <nlohmann/json_fwd.hpp>

#include "modules/gameplay/state/domain/GameValue.h"

namespace lila::modules::gameplay::infrastructure
{
[[nodiscard]] domain::GameValue DecodeGameValue(const nlohmann::json& raw);
[[nodiscard]] nlohmann::json EncodeGameValue(const domain::GameValue& value);
}
