#include <cassert>

#include "modules/gameplay/shell/application/GamePlayLifecycle.h"

int main()
{
    using lila::modules::gameplay::application::GamePlayLifecycle;
    using lila::modules::gameplay::application::GamePlayLifecycleState;
    using lila::modules::gameplay::domain::GameMatchStatus;

    GamePlayLifecycle lifecycle;
    assert(lifecycle.State() == GamePlayLifecycleState::Closed);
    lifecycle.Open(false);
    assert(lifecycle.BeginRoomStart());
    assert(lifecycle.IsStartFlowRequested());
    lifecycle.MarkRoomStartPending();
    assert(lifecycle.IsRoomStartPending());
    lifecycle.SetRoomStarted(true, false, 42);
    assert(lifecycle.IsAwaitingStartedState());
    assert(!lifecycle.AllowsGameplayInput());
    lifecycle.ObserveAuthoritativeState(41, GameMatchStatus::Playing);
    assert(lifecycle.IsAwaitingStartedState());
    lifecycle.ObserveAuthoritativeState(42, GameMatchStatus::Playing);
    assert(lifecycle.State() == GamePlayLifecycleState::Active);
    assert(lifecycle.AllowsGameplayInput());
    lifecycle.MarkReconnecting();
    assert(lifecycle.State() == GamePlayLifecycleState::Reconnecting);
    lifecycle.MarkConnected();
    assert(lifecycle.State() == GamePlayLifecycleState::Active);
    lifecycle.MarkFinished();
    assert(lifecycle.State() == GamePlayLifecycleState::Finished);
    lifecycle.Close();
    assert(!lifecycle.IsVisible());
}
