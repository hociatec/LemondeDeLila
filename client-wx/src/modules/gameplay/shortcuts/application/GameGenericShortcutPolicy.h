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
        const bool isBoardGame = state.kits.movement || state.kits.pawns || state.kits.grid;
        if (isBoardGame)
        {
            if (normalizedKey == "P") return "position";
            if (normalizedKey == "SHIFT+P") return "positions";
        }
        if (normalizedKey == "T") return "current-turn";
        if (normalizedKey == "S" && state.kits.score)
            return "score";
        // Card-hand information has no shortcut in board games: E must not
        // compete with the board's own keyboard surface.
        if (!isBoardGame && normalizedKey == "E" && state.kits.cards) return "hand";
        if (!isBoardGame && normalizedKey == "SHIFT+E" && state.kits.cards)
            return "hands";
        return {};
    }
};
}
