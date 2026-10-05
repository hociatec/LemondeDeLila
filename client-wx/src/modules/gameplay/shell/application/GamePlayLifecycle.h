#pragma once

#include "modules/gameplay/state/domain/GameSystem.h"

namespace lila::modules::gameplay::application
{
enum class GamePlayLifecycleState
{
    Closed,
    Joining,
    WaitingStart,
    ConfiguringStart,
    StartingRoom,
    Synchronizing,
    Active,
    Reconnecting,
    Finished,
};

enum class GamePlayFocusPolicy
{
    RoomAnchor,
    GameplayTarget,
};

struct GamePlayLifecyclePolicy final
{
    bool visible = false;
    bool acceptsInput = false;
    GamePlayFocusPolicy focus = GamePlayFocusPolicy::RoomAnchor;
};

class GamePlayLifecycle final
{
public:
    void Open(bool roomStarted) noexcept;
    void Close() noexcept;
    [[nodiscard]] bool BeginRoomStart() noexcept;
    void MarkRoomStartPending() noexcept;
    void SetRoomStarted(bool started, bool activeProjection, int expectedRunId) noexcept;
    void ObserveAuthoritativeState(int runId, domain::GameMatchStatus matchStatus) noexcept;
    void MarkReconnecting() noexcept;
    void MarkConnected() noexcept;
    void MarkFinished() noexcept;
    void StartFailed() noexcept;

    [[nodiscard]] GamePlayLifecycleState State() const noexcept;
    [[nodiscard]] bool IsRoomStarted() const noexcept;
    [[nodiscard]] bool HasAuthoritativeState() const noexcept;
    [[nodiscard]] bool IsAwaitingStartedState() const noexcept;
    [[nodiscard]] bool IsStartFlowRequested() const noexcept;
    [[nodiscard]] bool IsRoomStartPending() const noexcept;
    [[nodiscard]] bool IsVisible() const noexcept;
    [[nodiscard]] bool AllowsGameplayInput() const noexcept;
    [[nodiscard]] bool AllowsProjectedContentFocus() const noexcept;
    [[nodiscard]] bool AllowsActionSubmission(
        bool startConfigurationSubmission,
        bool serverAuthorizedPendingSubmission = false) const noexcept;
    [[nodiscard]] GamePlayLifecyclePolicy Policy() const noexcept;
    [[nodiscard]] static GamePlayLifecyclePolicy PolicyFor(
        GamePlayLifecycleState state) noexcept;

private:
    GamePlayLifecycleState state_ = GamePlayLifecycleState::Closed;
    bool hasAuthoritativeState_ = false;
    bool hasActiveProjection_ = false;
    int expectedRunId_ = 0;
};
}
