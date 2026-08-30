#pragma once

#include <optional>
#include <string>
#include <vector>

#include "modules/gameplay/actions/domain/GameAction.h"

namespace lila::modules::gameplay::application::grid
{
struct GameGridTarget final
{
    std::string boardId;
    std::string cellId;
    int x = 0;
    int y = 0;
};

class GameGridActionResolver final
{
public:
    [[nodiscard]] static bool Targets(
        const domain::GameAction& action, const GameGridTarget& target);
    [[nodiscard]] static std::optional<domain::GameAction> Resolve(
        const std::vector<domain::GameAction>& actions, const GameGridTarget& target);
};
}
