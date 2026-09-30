#include "modules/gameplay/shell/application/GamePlayLifecycle.h"

namespace lila::modules::gameplay::application
{
namespace
{
bool IsActiveStatus(std::string_view status) noexcept
{
    return status == "started" || status == "playing";
}
}

void GamePlayLifecycle::Open(bool roomStarted) noexcept
{
    state_ = roomStarted ? GamePlayLifecycleState::Joining
                         : GamePlayLifecycleState::WaitingStart;
    hasAuthoritativeState_ = false;
    expectedRunId_ = 0;
}

void GamePlayLifecycle::Close() noexcept
{
    state_ = GamePlayLifecycleState::Closed;
    hasAuthoritativeState_ = false;
    expectedRunId_ = 0;
}

bool GamePlayLifecycle::BeginRoomStart() noexcept
{
    if (state_ != GamePlayLifecycleState::WaitingStart) return false;
    state_ = GamePlayLifecycleState::ConfiguringStart;
    return true;
}

void GamePlayLifecycle::MarkRoomStartPending() noexcept
{
    if (state_ == GamePlayLifecycleState::ConfiguringStart)
        state_ = GamePlayLifecycleState::StartingRoom;
}

void GamePlayLifecycle::SetRoomStarted(
    bool started, bool activeProjection, int expectedRunId) noexcept
{
    expectedRunId_ = 0;
    if (!started)
    {
        state_ = GamePlayLifecycleState::WaitingStart;
        hasAuthoritativeState_ = false;
        return;
    }
    state_ = activeProjection ? GamePlayLifecycleState::Active
                              : GamePlayLifecycleState::Synchronizing;
    expectedRunId_ = activeProjection ? 0 : expectedRunId;
}

void GamePlayLifecycle::ObserveAuthoritativeState(
    int runId, std::string_view matchStatus) noexcept
{
    hasAuthoritativeState_ = true;
    if (matchStatus == "finished")
    {
        state_ = GamePlayLifecycleState::Finished;
        return;
    }
    const bool expectedRun = expectedRunId_ <= 0 || runId <= 0 || runId == expectedRunId_;
    if ((state_ == GamePlayLifecycleState::Joining ||
         state_ == GamePlayLifecycleState::Synchronizing ||
         state_ == GamePlayLifecycleState::Reconnecting) &&
        expectedRun && IsActiveStatus(matchStatus))
    {
        state_ = GamePlayLifecycleState::Active;
        expectedRunId_ = 0;
    }
}

void GamePlayLifecycle::MarkReconnecting() noexcept
{
    if (IsRoomStarted()) state_ = GamePlayLifecycleState::Reconnecting;
}

void GamePlayLifecycle::MarkConnected() noexcept
{
    if (state_ == GamePlayLifecycleState::Reconnecting)
        state_ = hasAuthoritativeState_ ? GamePlayLifecycleState::Active
                                       : GamePlayLifecycleState::Synchronizing;
}

void GamePlayLifecycle::MarkFinished() noexcept
{
    state_ = GamePlayLifecycleState::Finished;
}

void GamePlayLifecycle::StartFailed() noexcept
{
    if (!IsRoomStarted()) state_ = GamePlayLifecycleState::WaitingStart;
}

GamePlayLifecycleState GamePlayLifecycle::State() const noexcept { return state_; }

bool GamePlayLifecycle::IsRoomStarted() const noexcept
{
    return state_ == GamePlayLifecycleState::Joining ||
        state_ == GamePlayLifecycleState::Synchronizing ||
        state_ == GamePlayLifecycleState::Active ||
        state_ == GamePlayLifecycleState::Reconnecting ||
        state_ == GamePlayLifecycleState::Finished;
}

bool GamePlayLifecycle::HasAuthoritativeState() const noexcept
{
    return hasAuthoritativeState_;
}

bool GamePlayLifecycle::IsAwaitingStartedState() const noexcept
{
    return state_ == GamePlayLifecycleState::Synchronizing;
}

bool GamePlayLifecycle::IsStartFlowRequested() const noexcept
{
    return state_ == GamePlayLifecycleState::ConfiguringStart;
}

bool GamePlayLifecycle::IsRoomStartPending() const noexcept
{
    return state_ == GamePlayLifecycleState::StartingRoom;
}

bool GamePlayLifecycle::IsVisible() const noexcept
{
    return state_ != GamePlayLifecycleState::Closed &&
        state_ != GamePlayLifecycleState::WaitingStart;
}

bool GamePlayLifecycle::AllowsGameplayInput() const noexcept
{
    return state_ == GamePlayLifecycleState::Active && hasAuthoritativeState_;
}
}
