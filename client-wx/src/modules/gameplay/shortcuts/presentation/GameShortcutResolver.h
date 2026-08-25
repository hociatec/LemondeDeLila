#pragma once

#include <cstddef>
#include <optional>
#include <string>

#include <wx/string.h>

#include "modules/gameplay/actions/domain/GameAction.h"
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
        const std::string& normalizedKey);
    [[nodiscard]] static std::optional<domain::GameAction> ResolveAction(
        const domain::GameState& state,
        const std::string& actionType,
        int selectedLine);
    [[nodiscard]] static std::optional<domain::GameAction> ResolveHandAction(
        const domain::GameState& state,
        std::size_t selectedCard);
    [[nodiscard]] static std::string NormalizeKey(const wxKeyEvent& event);
    [[nodiscard]] static wxString BuildHelpText(const domain::GameState& state);
};
}
