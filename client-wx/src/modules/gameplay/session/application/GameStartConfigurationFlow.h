#pragma once

#include <string_view>

#include "modules/gameplay/state/domain/GameSystem.h"

namespace lila::modules::gameplay::application
{
class GameStartConfigurationFlow final
{
public:
    [[nodiscard]] bool TryBeginSubmission(const domain::GameSetup& setup) noexcept
    {
        if (phase_ != Phase::Idle || setup.complete) return false;
        phase_ = Phase::AwaitingActionAcknowledgement;
        return true;
    }

    [[nodiscard]] bool Acknowledge(std::string_view command) noexcept
    {
        if (phase_ != Phase::AwaitingActionAcknowledgement || command != "game.action")
            return false;
        phase_ = Phase::AwaitingSetupProjection;
        return true;
    }

    [[nodiscard]] bool ObserveSetup(const domain::GameSetup& setup) noexcept
    {
        if (!setup.complete ||
            (phase_ != Phase::AwaitingActionAcknowledgement &&
             phase_ != Phase::AwaitingSetupProjection))
            return false;
        // The committed setup projection is sufficient proof that the
        // configuration succeeded. WebSocket state and acknowledgement
        // messages may legally arrive in either order.
        phase_ = Phase::AwaitingRoomStart;
        return true;
    }

    [[nodiscard]] bool IsAwaitingActionAcknowledgement() const noexcept
    {
        return phase_ == Phase::AwaitingActionAcknowledgement;
    }

    [[nodiscard]] bool IsAwaitingRoomStart() const noexcept
    {
        return phase_ == Phase::AwaitingRoomStart;
    }

    void Reset() noexcept
    {
        phase_ = Phase::Idle;
    }

private:
    enum class Phase
    {
        Idle,
        AwaitingActionAcknowledgement,
        AwaitingSetupProjection,
        AwaitingRoomStart,
    };

    Phase phase_ = Phase::Idle;
};
}
