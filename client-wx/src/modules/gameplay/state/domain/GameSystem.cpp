#include "modules/gameplay/state/domain/GameSystem.h"

namespace lila::modules::gameplay::domain
{
std::string GameEngineEvent::Identity() const
{
    if (!id.empty()) return "id:" + id;
    if (sequence) return "sequence:" + std::to_string(*sequence);
    return type + ":" + std::to_string(occurredAtMs) + ":" +
        std::to_string(actorId.value_or(0));
}
}
