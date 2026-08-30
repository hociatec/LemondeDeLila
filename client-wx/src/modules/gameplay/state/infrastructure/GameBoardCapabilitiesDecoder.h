#pragma once

#include <optional>

#include <nlohmann/json_fwd.hpp>

#include "modules/gameplay/state/domain/GameCapabilities.h"

namespace lila::modules::gameplay::infrastructure
{
struct GameBoardCapabilitiesDecoder final
{
    [[nodiscard]] static std::optional<domain::GameMovementView> Movement(const nlohmann::json& raw);
    [[nodiscard]] static std::optional<domain::GamePawnsView> Pawns(const nlohmann::json& raw);
    [[nodiscard]] static std::optional<domain::GameGridView> Grid(const nlohmann::json& raw);
};
}
