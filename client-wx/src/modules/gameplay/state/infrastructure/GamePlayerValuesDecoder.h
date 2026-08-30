#pragma once

#include <optional>

#include <nlohmann/json_fwd.hpp>

#include "modules/gameplay/state/domain/GameCapabilities.h"

namespace lila::modules::gameplay::infrastructure
{
struct GamePlayerValuesDecoder final
{
    static std::optional<domain::GameScoreView> Score(const nlohmann::json& raw);
    static std::optional<domain::GameResourcesView> Resources(const nlohmann::json& raw);
    static std::optional<domain::GameCountersView> Counters(const nlohmann::json& raw);
    static std::optional<domain::GameStatusView> Status(const nlohmann::json& raw);
};
}
