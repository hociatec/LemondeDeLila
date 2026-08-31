#pragma once

#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "modules/gameplay/actions/domain/GameAction.h"
#include "modules/gameplay/prompts/domain/GamePrompt.h"
#include "modules/gameplay/shortcuts/domain/GameShortcut.h"

namespace lila::modules::gameplay::infrastructure::detail
{
[[nodiscard]] std::vector<domain::GameAction> DecodeActions(const nlohmann::json& payload);
[[nodiscard]] std::vector<domain::GameShortcut> DecodeShortcuts(const nlohmann::json& system);
[[nodiscard]] std::optional<domain::GamePrompt> DecodePrompt(const nlohmann::json& stateNode);
[[nodiscard]] std::string NormalizeShortcutKey(std::string rawKey);
}
