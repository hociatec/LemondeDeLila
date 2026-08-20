#pragma once

#include "modules/options/domain/OptionsState.h"

#include <nlohmann/json.hpp>

namespace lila::modules::options::infrastructure::json
{
[[nodiscard]] domain::OptionsState ParseStateFromDocument(const nlohmann::json& document);
[[nodiscard]] nlohmann::json BuildStateDocument(const domain::OptionsState& state);
}
