#pragma once

#include <string>

#include <nlohmann/json_fwd.hpp>

#include "modules/gameplay/state/domain/GameState.h"

namespace lila::modules::gameplay::application::info
{
class GameCapabilityTextBuilder final
{
public:
    [[nodiscard]] static std::string Build(
        const domain::GameState& state,
        const std::string& capability);
    [[nodiscard]] static std::string JsonLines(
        const nlohmann::json& value,
        const std::string& prefix = {});
};
}
