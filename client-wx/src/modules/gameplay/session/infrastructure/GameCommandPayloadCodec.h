#pragma once

#include <nlohmann/json_fwd.hpp>

#include "modules/gameplay/session/domain/GameActionCandidates.h"
#include "modules/gameplay/session/domain/GameCommandEnvelope.h"

namespace lila::modules::gameplay::infrastructure
{
class GameCommandPayloadCodec final
{
public:
    [[nodiscard]] static nlohmann::json EncodeAction(
        const domain::GameCommandEnvelope& command);
    [[nodiscard]] static nlohmann::json EncodeCandidatesRequest(
        int roomId,
        const std::string& gameType,
        const domain::GameActionCandidatesRequest& request);
    [[nodiscard]] static domain::GameActionCandidatesResult DecodeCandidates(
        const nlohmann::json& payload);
};
}
