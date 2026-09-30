#pragma once

#include <nlohmann/json.hpp>

#include "modules/gameplay/state/domain/GameValue.h"

namespace lila::modules::gameplay::application
{
// Converts an already-projected game value to/from an action payload. This is
// application work: presentation may build an action without depending on a
// state transport decoder.
[[nodiscard]] domain::GameValue DecodeGameValuePayload(const nlohmann::json& raw);
[[nodiscard]] nlohmann::json EncodeGameValuePayload(const domain::GameValue& value);
}
