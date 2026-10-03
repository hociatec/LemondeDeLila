#pragma once

#include <optional>
#include <vector>

#include "modules/gameplay/actions/domain/GameAction.h"

namespace lila::modules::gameplay::application::workflows
{
class GameQuizActionResolver final
{
public:
    [[nodiscard]] static std::optional<domain::GameAction> Resolve(
        const std::vector<domain::GameAction>& actions,
        int answerIndex);
};
}
