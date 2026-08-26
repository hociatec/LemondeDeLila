#pragma once

#include <algorithm>
#include <cctype>
#include <string>

#include "modules/gameplay/state/domain/GameState.h"

namespace lila::modules::gameplay::application
{
class GameStateUpdatePolicy final
{
public:
    [[nodiscard]] static bool ShouldApply(
        const domain::GameState& current,
        const domain::GameState& incoming) noexcept
    {
        if (current.roomId <= 0 || incoming.roomId != current.roomId ||
            incoming.gameType != current.gameType)
            return true;

        if (current.runId > 0 && incoming.runId > 0 &&
            incoming.runId != current.runId)
            return incoming.runId > current.runId;

        // A delayed setup snapshot must not cover an already active round.
        // Keep allowing a real reset when it carries a strictly newer version.
        if (IsActiveRound(current) && IsSetup(incoming) &&
            (current.version <= 0 || incoming.version <= current.version))
            return false;

        if (current.version <= 0 || incoming.version <= 0) return true;
        return incoming.version >= current.version;
    }

private:
    [[nodiscard]] static std::string Normalize(std::string value)
    {
        std::transform(value.begin(), value.end(), value.begin(),
            [](unsigned char ch) { return static_cast<char>(std::tolower(ch)); });
        return value;
    }

    [[nodiscard]] static bool IsActiveRound(const domain::GameState& state)
    {
        return Normalize(state.status) == "started" || Normalize(state.phase) == "round" ||
            !state.hand.empty();
    }

    [[nodiscard]] static bool IsSetup(const domain::GameState& state)
    {
        return Normalize(state.status) == "setup" || Normalize(state.phase) == "setup";
    }
};
}
