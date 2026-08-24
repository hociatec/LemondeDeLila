#pragma once

#include <optional>
#include <string>

#include <wx/string.h>

#include "modules/gameplay/domain/GameAction.h"
#include "modules/gameplay/domain/GameShortcut.h"
#include "modules/gameplay/domain/GameState.h"

class wxKeyEvent;

namespace lila::modules::gameplay::presentation::shortcuts
{
class GameShortcutResolver final
{
public:
    [[nodiscard]] static const domain::GameShortcut* Find(
        const domain::GameState& state,
        const std::string& normalizedKey);
    [[nodiscard]] static std::optional<domain::GameAction> ResolveAction(
        const domain::GameState& state,
        const std::string& actionType,
        int selectedLine);
    [[nodiscard]] static std::string NormalizeKey(const wxKeyEvent& event);
    [[nodiscard]] static wxString BuildHelpText(const domain::GameState& state);
};
}
