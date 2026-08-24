#pragma once

#include <optional>

#include "modules/gameplay/domain/GameAction.h"
#include "modules/gameplay/domain/GamePrompt.h"

class wxWindow;

namespace lila::modules::gameplay::presentation
{
class GameActionPromptDialog final
{
public:
    [[nodiscard]] static std::optional<domain::GameAction> Prepare(
        wxWindow& parent,
        domain::GameAction action,
        const std::optional<domain::GamePrompt>& prompt);
};
}
