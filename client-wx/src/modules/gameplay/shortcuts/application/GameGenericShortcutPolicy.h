#pragma once

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
        if (state.kits.movement || state.kits.pawns)
        {
            if (normalizedKey == "P") return "position";
            if (normalizedKey == "SHIFT+P") return "positions";
        }
        if (normalizedKey == "S" && state.kits.score)
            return "score";
        if (normalizedKey == "E" && state.kits.cards) return "hand";
        return {};
    }
};
}
