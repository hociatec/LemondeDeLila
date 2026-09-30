#pragma once
#include <string>
#include "modules/gameplay/state/domain/GameSystem.h"

namespace lila::modules::gameplay::application
{
inline std::string GameSoundEventType(const domain::GameEngineEvent& event)
{
    return event.soundSemantic;
}
}
