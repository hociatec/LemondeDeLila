#include "modules/gameplay/workflows/application/GameQuizActionResolver.h"

namespace lila::modules::gameplay::application::workflows
{
std::optional<domain::GameAction> GameQuizActionResolver::Resolve(
    const std::vector<domain::GameAction>& actions,
    int answerIndex)
{
    for (const auto& action : actions)
    {
        if (action.disabled) continue;
        const auto value = action.payload.find("answerIndex");
        if (value != action.payload.end() && value->second.Integer() == answerIndex)
            return action;
    }
    return std::nullopt;
}
}
