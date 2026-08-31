#pragma once

#include <optional>
#include <string>
#include <vector>

#include <wx/string.h>

#include "modules/gameplay/actions/domain/GameAction.h"
#include "modules/gameplay/state/domain/GameLine.h"
#include "modules/gameplay/shortcuts/domain/GameShortcut.h"
#include "modules/gameplay/state/domain/GameState.h"

class wxKeyEvent;

namespace lila::modules::gameplay::presentation::shortcuts
{
class GameShortcutResolver final
{
public:
    [[nodiscard]] static const domain::GameShortcut* Find(
        const domain::GameState& state,
        const std::vector<domain::GameLine>& lines,
        const std::string& normalizedKey);
    [[nodiscard]] static std::optional<domain::GameAction> ResolveAction(
        const domain::GameState& state,
        const std::vector<domain::GameLine>& lines,
        const std::string& actionType,
        int selectedLine);
    [[nodiscard]] static std::string NormalizeKey(const wxKeyEvent& event);
    [[nodiscard]] static wxString BuildHelpText(const domain::GameState& state);
};
}
