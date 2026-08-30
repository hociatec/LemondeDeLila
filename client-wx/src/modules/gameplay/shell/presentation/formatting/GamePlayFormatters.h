#pragma once

#include <iosfwd>
#include <string>

#include <nlohmann/json_fwd.hpp>
#include <wx/string.h>

#include "modules/gameplay/state/domain/GameState.h"

namespace lila::modules::gameplay::presentation
{
[[nodiscard]] wxString FromUtf8(const std::string& value);
[[nodiscard]] std::string CurrentPlayerLabel(const domain::GameState& state);
[[nodiscard]] std::string TurnLabel(const domain::GameState& state);
[[nodiscard]] std::string JsonToDisplay(const nlohmann::json& value);
[[nodiscard]] std::string PanelJsonToDisplay(const nlohmann::json& value);
void AppendJsonObjectLines(std::ostringstream& out, const nlohmann::json& object);
}
