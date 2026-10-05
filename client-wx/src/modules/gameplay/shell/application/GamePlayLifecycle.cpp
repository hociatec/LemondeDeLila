#include "modules/gameplay/shell/application/GamePlayLifecycle.h"

namespace lila::modules::gameplay::application
{
void GamePlayLifecycle::Open(bool roomStarted) noexcept
{
    state_ = roomStarted ? GamePlayLifecycleState::Joining
                         : GamePlayLifecycleState::WaitingStart;
    hasAuthoritativeState_ = false;
    hasActiveProjection_ = false;
    expectedRunId_ = 0;
}

void GamePlayLifecycle::Close() noexcept
{
    state_ = GamePlayLifecycleState::Closed;
    hasAuthoritativeState_ = false;
    hasActiveProjection_ = false;
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
        hasActiveProjection_ = false;
        return;
    }
    state_ = activeProjection ? GamePlayLifecycleState::Active
                              : GamePlayLifecycleState::Synchronizing;
    expectedRunId_ = activeProjection ? 0 : expectedRunId;
}

void GamePlayLifecycle::ObserveAuthoritativeState(
    int runId, domain::GameMatchStatus matchStatus) noexcept
{
    hasAuthoritativeState_ = true;
    hasActiveProjection_ = domain::IsInteractive(matchStatus);
    if (matchStatus == domain::GameMatchStatus::Finished)
    {
        state_ = GamePlayLifecycleState::Finished;
        return;
    }
    const bool expectedRun = expectedRunId_ <= 0 || runId <= 0 || runId == expectedRunId_;
    if ((state_ == GamePlayLifecycleState::Joining ||
         state_ == GamePlayLifecycleState::Synchronizing ||
         state_ == GamePlayLifecycleState::Reconnecting) &&
        expectedRun && domain::IsInteractive(matchStatus))
    {
        state_ = GamePlayLifecycleState::Active;
        expectedRunId_ = 0;
    }
}

void GamePlayLifecycle::MarkReconnecting() noexcept
{
    if (!IsRoomStarted()) return;
    state_ = GamePlayLifecycleState::Reconnecting;
    // The projection visible before transport loss is no longer authoritative.
    // Keep it readable, but never activate it until the reconnect snapshot.
    hasAuthoritativeState_ = false;
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
    return Policy().visible;
}

bool GamePlayLifecycle::AllowsGameplayInput() const noexcept
{
    return Policy().acceptsInput && hasAuthoritativeState_;
}

bool GamePlayLifecycle::AllowsProjectedContentFocus() const noexcept
{
    return hasAuthoritativeState_ && hasActiveProjection_ &&
        (state_ == GamePlayLifecycleState::ConfiguringStart ||
         state_ == GamePlayLifecycleState::StartingRoom ||
         state_ == GamePlayLifecycleState::Active);
}

bool GamePlayLifecycle::AllowsActionSubmission(
    bool startConfigurationSubmission,
    bool serverAuthorizedPendingSubmission) const noexcept
{
    return AllowsGameplayInput() ||
        (startConfigurationSubmission &&
         state_ == GamePlayLifecycleState::ConfiguringStart &&
         hasAuthoritativeState_) ||
        (serverAuthorizedPendingSubmission &&
         (state_ == GamePlayLifecycleState::ConfiguringStart ||
          state_ == GamePlayLifecycleState::StartingRoom) &&
         hasAuthoritativeState_);
}

GamePlayLifecyclePolicy GamePlayLifecycle::Policy() const noexcept
{
    return PolicyFor(state_);
}

GamePlayLifecyclePolicy GamePlayLifecycle::PolicyFor(
    GamePlayLifecycleState state) noexcept
{
    switch (state)
    {
    case GamePlayLifecycleState::Closed:
    case GamePlayLifecycleState::WaitingStart:
        return {false, false, GamePlayFocusPolicy::RoomAnchor};
    case GamePlayLifecycleState::Joining:
    case GamePlayLifecycleState::ConfiguringStart:
    case GamePlayLifecycleState::StartingRoom:
    case GamePlayLifecycleState::Synchronizing:
    case GamePlayLifecycleState::Reconnecting:
        return {true, false, GamePlayFocusPolicy::RoomAnchor};
    case GamePlayLifecycleState::Active:
        return {true, true, GamePlayFocusPolicy::GameplayTarget};
    case GamePlayLifecycleState::Finished:
        return {true, false, GamePlayFocusPolicy::RoomAnchor};
    }
    return {};
}
}
