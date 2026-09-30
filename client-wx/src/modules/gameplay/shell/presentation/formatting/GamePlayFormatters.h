#pragma once

#include <string>

#include <wx/string.h>

#include "modules/gameplay/state/domain/GameState.h"

namespace lila::modules::gameplay::presentation
{
[[nodiscard]] wxString FromUtf8(const std::string& value);
[[nodiscard]] std::string CurrentPlayerLabel(const domain::GameState& state);
[[nodiscard]] std::string TurnLabel(const domain::GameState& state);
[[nodiscard]] std::string GameValueToDisplay(const domain::GameValue& value);
[[nodiscard]] std::string PanelGameValueToDisplay(const domain::GameValue& value);
}
