#pragma once

#include <string_view>

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

class GamePlayLifecycle final
{
public:
    void Open(bool roomStarted) noexcept;
    void Close() noexcept;
    [[nodiscard]] bool BeginRoomStart() noexcept;
    void MarkRoomStartPending() noexcept;
    void SetRoomStarted(bool started, bool activeProjection, int expectedRunId) noexcept;
    void ObserveAuthoritativeState(int runId, std::string_view matchStatus) noexcept;
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

private:
    GamePlayLifecycleState state_ = GamePlayLifecycleState::Closed;
    bool hasAuthoritativeState_ = false;
    int expectedRunId_ = 0;
};
}
