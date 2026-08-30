#pragma once

#include <optional>
#include <string>

#include "modules/gameplay/state/domain/GameState.h"

namespace lila::modules::gameplay::application::info
{
[[nodiscard]] std::optional<std::string> BuildBoardCapabilityText(
    const domain::GameState& state, const std::string& capability);
[[nodiscard]] std::optional<std::string> BuildValueCapabilityText(
    const domain::GameState& state, const std::string& capability);
[[nodiscard]] std::optional<std::string> BuildAssetCapabilityText(
    const domain::GameState& state, const std::string& capability);
[[nodiscard]] std::optional<std::string> BuildWorkflowCapabilityText(
    const domain::GameState& state, const std::string& capability);
}
