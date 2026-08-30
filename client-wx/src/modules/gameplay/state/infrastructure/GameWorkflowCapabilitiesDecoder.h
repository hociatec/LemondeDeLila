#pragma once

#include <optional>
#include <vector>

#include <nlohmann/json_fwd.hpp>

#include "modules/gameplay/state/domain/GameCapabilities.h"

namespace lila::modules::gameplay::infrastructure
{
struct GameWorkflowCapabilitiesDecoder final
{
    static std::optional<domain::GameQuizView> Quiz(const nlohmann::json& raw);
    static std::optional<domain::GameSubmissionsView> Submissions(const nlohmann::json& raw);
    static std::optional<domain::GameEffectView> Effect(const nlohmann::json& raw);
    static std::vector<domain::GameTimerView> Timers(const nlohmann::json& raw);
};
}
