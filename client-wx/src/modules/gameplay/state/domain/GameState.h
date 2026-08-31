#pragma once

#include <string>
#include <optional>
#include <vector>

#include "modules/gameplay/actions/domain/GameAction.h"
#include "modules/gameplay/actions/domain/GameActionDescriptor.h"
#include "modules/gameplay/state/domain/GamePending.h"
#include "modules/gameplay/state/domain/GameSystem.h"
#include "modules/gameplay/state/domain/GameKits.h"

namespace lila::modules::gameplay::domain
{
struct GameState final
{
    // The backend increments this only for breaking projection changes.
    static constexpr int SupportedViewVersion = 1;

    int roomId = 0;
    int runId = 0;
    int version = 0;
    int viewVersion = 0;
    std::string gameType;
    std::vector<GameAction> actions;
    std::optional<GamePending> pending;
    GameSystem system;
    GameKits kits;
    std::optional<GameEffectView> effect;
    GameValue game;
    std::vector<GameActionDescriptor> actionCatalog;
    std::vector<GameTimerView> timers;
};
}
