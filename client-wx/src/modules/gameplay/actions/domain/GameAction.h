#pragma once

#include <string>

#include "modules/gameplay/state/domain/GameValue.h"

namespace lila::modules::gameplay::domain
{
struct GameAction final
{
    std::string type;
    std::string label;
    std::string documentation;
    GameValue::Object payload;
    bool disabled = false;
    bool confirm = false;
};
}
