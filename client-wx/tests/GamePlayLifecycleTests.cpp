#include <array>
#include <cassert>

#include "modules/gameplay/shell/application/GamePlayLifecycle.h"
#include "modules/gameplay/shell/application/GamePlayAccessPolicy.h"

int main()
{
    using namespace lila::modules::gameplay;
    using application::GamePlayFocusPolicy;
    using application::GamePlayAccessPolicy;
    using application::GamePlayLifecycle;
    using application::GamePlayLifecycleState;
    using domain::GameMatchStatus;

    static_assert(GamePlayAccessPolicy::KeepStableEntryVisible());
    static_assert(GamePlayAccessPolicy::IsUsableTarget(true, true, true));
    static_assert(!GamePlayAccessPolicy::IsUsableTarget(false, true, true));
    static_assert(!GamePlayAccessPolicy::IsUsableTarget(true, false, true));
    static_assert(!GamePlayAccessPolicy::IsUsableTarget(true, true, false));
    static_assert(GamePlayAccessPolicy::ShouldReplaceContentWithOverlay(true, true));
    static_assert(!GamePlayAccessPolicy::ShouldReplaceContentWithOverlay(true, false));

    constexpr std::array allStates{
        GamePlayLifecycleState::Closed,
        GamePlayLifecycleState::Joining,
        GamePlayLifecycleState::WaitingStart,
        GamePlayLifecycleState::ConfiguringStart,
        GamePlayLifecycleState::StartingRoom,
        GamePlayLifecycleState::Synchronizing,
        GamePlayLifecycleState::Active,
        GamePlayLifecycleState::Reconnecting,
        GamePlayLifecycleState::Finished,
    };
    for (const auto state : allStates)
    {
        const auto policy = GamePlayLifecycle::PolicyFor(state);
        assert(policy.acceptsInput == (state == GamePlayLifecycleState::Active));
        assert(policy.focus == (state == GamePlayLifecycleState::Active
            ? GamePlayFocusPolicy::GameplayTarget
            : GamePlayFocusPolicy::RoomAnchor));
        assert(policy.visible == (state != GamePlayLifecycleState::Closed &&
            state != GamePlayLifecycleState::WaitingStart));
    }

    GamePlayLifecycle lifecycle;
    assert(lifecycle.State() == GamePlayLifecycleState::Closed);
    lifecycle.Open(false);
    assert(lifecycle.State() == GamePlayLifecycleState::WaitingStart);
    lifecycle.ObserveAuthoritativeState(1, GameMatchStatus::Setup);
    assert(lifecycle.BeginRoomStart());
    assert(lifecycle.State() == GamePlayLifecycleState::ConfiguringStart);
    assert(!lifecycle.AllowsGameplayInput());
    assert(!lifecycle.AllowsProjectedContentFocus());
    assert(!lifecycle.AllowsActionSubmission(false));
    assert(lifecycle.AllowsActionSubmission(true));
    lifecycle.MarkRoomStartPending();
    assert(lifecycle.State() == GamePlayLifecycleState::StartingRoom);
    assert(!lifecycle.AllowsActionSubmission(true));
    assert(lifecycle.AllowsActionSubmission(false, true));
    lifecycle.ObserveAuthoritativeState(42, GameMatchStatus::Playing);
    assert(lifecycle.AllowsProjectedContentFocus());
    assert(!lifecycle.AllowsGameplayInput());
    lifecycle.SetRoomStarted(true, false, 42);
    assert(lifecycle.State() == GamePlayLifecycleState::Synchronizing);
    lifecycle.ObserveAuthoritativeState(41, GameMatchStatus::Playing);
    assert(lifecycle.State() == GamePlayLifecycleState::Synchronizing);
    lifecycle.ObserveAuthoritativeState(42, GameMatchStatus::Playing);
    assert(lifecycle.State() == GamePlayLifecycleState::Active);
    assert(lifecycle.AllowsGameplayInput());
    lifecycle.MarkReconnecting();
    assert(lifecycle.State() == GamePlayLifecycleState::Reconnecting);
    assert(!lifecycle.AllowsGameplayInput());
    lifecycle.MarkConnected();
    assert(lifecycle.State() == GamePlayLifecycleState::Synchronizing);
    lifecycle.ObserveAuthoritativeState(42, GameMatchStatus::Playing);
    assert(lifecycle.State() == GamePlayLifecycleState::Active);
    lifecycle.MarkFinished();
    assert(lifecycle.State() == GamePlayLifecycleState::Finished);
    lifecycle.SetRoomStarted(false, false, 0);
    assert(lifecycle.State() == GamePlayLifecycleState::WaitingStart);

    // Room-start and projection notifications are valid in either order.
    lifecycle.Open(false);
    lifecycle.ObserveAuthoritativeState(77, GameMatchStatus::Playing);
    lifecycle.SetRoomStarted(true, true, 77);
    assert(lifecycle.State() == GamePlayLifecycleState::Active);
    lifecycle.Close();
    lifecycle.Open(true);
    lifecycle.SetRoomStarted(true, false, 88);
    lifecycle.ObserveAuthoritativeState(88, GameMatchStatus::Playing);
    assert(lifecycle.State() == GamePlayLifecycleState::Active);

    // Failed and cancelled configuration return to the stable room entry.
    lifecycle.SetRoomStarted(false, false, 0);
    assert(lifecycle.BeginRoomStart());
    lifecycle.StartFailed();
    assert(lifecycle.State() == GamePlayLifecycleState::WaitingStart);
    assert(!lifecycle.IsVisible());

    lifecycle.Open(true);
    lifecycle.ObserveAuthoritativeState(3, GameMatchStatus::Finished);
    assert(lifecycle.State() == GamePlayLifecycleState::Finished);
    lifecycle.Close();
    assert(!lifecycle.IsVisible());
}
