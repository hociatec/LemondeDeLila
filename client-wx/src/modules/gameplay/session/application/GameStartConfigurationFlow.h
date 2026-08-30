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
        if (phase_ != Phase::AwaitingActionAcknowledgement || command != "game.actions")
            return false;
        phase_ = Phase::AwaitingSetupProjection;
        return true;
    }

    [[nodiscard]] bool ObserveSetup(const domain::GameSetup& setup) noexcept
    {
        if (phase_ != Phase::AwaitingSetupProjection || !setup.complete) return false;
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
