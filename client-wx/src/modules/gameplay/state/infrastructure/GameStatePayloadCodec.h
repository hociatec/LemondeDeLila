#pragma once

#include <string>

#include <nlohmann/json.hpp>

#include "modules/gameplay/state/domain/GameState.h"

namespace lila::modules::gameplay::infrastructure
{
class GameStatePayloadCodec final
{
public:
    [[nodiscard]] static domain::GameState DecodeState(const nlohmann::json& payload);
    [[nodiscard]] static std::string NormalizeShortcutKey(std::string rawKey);
};
}
