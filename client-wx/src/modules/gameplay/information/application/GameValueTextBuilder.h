#pragma once

#include <string>

#include "modules/gameplay/state/domain/GameValue.h"

namespace lila::modules::gameplay::application::info
{
[[nodiscard]] std::string HumanLabel(std::string id);
[[nodiscard]] std::string ValueLines(
    const domain::GameValue& value, const std::string& prefix = {});
}
