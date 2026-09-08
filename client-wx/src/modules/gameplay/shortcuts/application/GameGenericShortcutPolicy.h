#pragma once

#include <algorithm>
#include <string>

#include "modules/gameplay/state/domain/GameState.h"

namespace lila::modules::gameplay::application::shortcuts
{
class GameGenericShortcutPolicy final
{
public:
    [[nodiscard]] static std::string ResolveInterface(
        const domain::GameState& state,
        const std::string& normalizedKey)
    {
        // Reserved client-wide gameplay keys: their availability must not
        // depend on shortcuts declared by an individual game.
        if (normalizedKey == "T") return "current-turn";
        if (state.kits.movement)
        {
            if (normalizedKey == "P") return "position";
            if (normalizedKey == "SHIFT+P") return "positions";
        }
        if (normalizedKey == "S" && state.kits.score)
        {
            const auto declared = std::find_if(
                state.system.shortcuts.begin(), state.system.shortcuts.end(),
                [](const domain::GameShortcut& shortcut)
                {
                    return shortcut.normalizedKey == "S" &&
                        shortcut.kind == domain::GameShortcutKind::Interface;
                });
            if (declared == state.system.shortcuts.end()) return "score";
        }
        if (normalizedKey == "E" && state.kits.cards) return "hand";
        return {};
    }
};
}
