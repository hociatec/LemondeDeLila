#pragma once

#include <string>

#include "modules/gameplay/state/domain/GameSystem.h"

namespace lila::modules::gameplay::presentation::events
{
class GameEventPresenter final
{
public:
    [[nodiscard]] static std::string Present(
        const domain::GameEngineEvent& event,
        const std::vector<domain::GamePlayer>& players);
};
}
