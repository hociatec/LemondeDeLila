#pragma once

#include <chrono>
#include <string>
#include <string_view>

namespace lila::modules::gameplay::application
{
class GameCommandSubmissionGuard final
{
public:
    using Clock = std::chrono::steady_clock;
    using TimePoint = Clock::time_point;

    [[nodiscard]] bool TryBegin(
        std::string_view command,
        int stateVersion,
        int runId = 0,
        TimePoint now = Clock::now())
    {
        if (command.empty()) return false;
        if (inFlight_) return false;
        command_ = command;
        sourceVersion_ = stateVersion;
        sourceRunId_ = runId;
        startedAt_ = now;
        inFlight_ = true;
        return true;
    }

    void ObserveState(int stateVersion, int runId = 0) noexcept
    {
        if (!inFlight_) return;
        const bool changedRun = sourceRunId_ > 0 && runId > 0 && runId != sourceRunId_;
        if (changedRun || sourceVersion_ <= 0 || stateVersion <= 0 ||
            stateVersion > sourceVersion_)
            Reset();
    }

    [[nodiscard]] bool Acknowledge(std::string_view command) noexcept
    {
        if (!inFlight_ || command != command_) return false;
        Reset();
        return true;
    }

    void Reset() noexcept
    {
        command_.clear();
        inFlight_ = false;
        sourceVersion_ = 0;
        sourceRunId_ = 0;
        startedAt_ = {};
    }

    [[nodiscard]] bool IsInFlight() const noexcept { return inFlight_; }

private:
    std::string command_;
    bool inFlight_ = false;
    int sourceVersion_ = 0;
    int sourceRunId_ = 0;
    TimePoint startedAt_{};
};
}
