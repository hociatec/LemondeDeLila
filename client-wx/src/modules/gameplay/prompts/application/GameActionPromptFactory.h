#pragma once

#include <optional>

#include <nlohmann/json_fwd.hpp>

#include "modules/gameplay/actions/domain/GameAction.h"
#include "modules/gameplay/prompts/domain/GamePrompt.h"

namespace lila::modules::gameplay::application
{
class GameActionPromptFactory final
{
public:
    [[nodiscard]] static std::optional<domain::GamePrompt> Build(
        const domain::GameAction& action,
        const nlohmann::json& actionCatalog);
};
}
