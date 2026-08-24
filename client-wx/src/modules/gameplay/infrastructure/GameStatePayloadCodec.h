#pragma once

#include <string>

#include <nlohmann/json.hpp>

#include "modules/gameplay/domain/GameState.h"

namespace lila::modules::gameplay::infrastructure
{
class GameStatePayloadCodec final
{
public:
    [[nodiscard]] static domain::GameState DecodeState(const nlohmann::json& payload);
    [[nodiscard]] static nlohmann::json EncodeActionPayload(
        int roomId,
        const std::string& gameType,
        const domain::GameAction& action);
    [[nodiscard]] static std::string NormalizeShortcutKey(std::string rawKey);
};
}
