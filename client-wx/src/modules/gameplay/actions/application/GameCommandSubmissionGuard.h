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
        TimePoint now = Clock::now(),
        std::string_view correlationId = {})
    {
        if (command.empty()) return false;
        if (inFlight_) return false;
        command_ = command;
        sourceVersion_ = stateVersion;
        sourceRunId_ = runId;
        correlationId_ = correlationId;
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

    [[nodiscard]] bool Acknowledge(
        std::string_view command,
        bool release = true,
        std::string_view correlationId = {}) noexcept
    {
        if (!inFlight_ || command != command_) return false;
        if (!correlationId_.empty() && correlationId != correlationId_) return false;
        if (release) Reset();
        return true;
    }

    void Reset() noexcept
    {
        command_.clear();
        inFlight_ = false;
        sourceVersion_ = 0;
        sourceRunId_ = 0;
        correlationId_.clear();
        startedAt_ = {};
    }

    [[nodiscard]] bool IsInFlight() const noexcept { return inFlight_; }

    [[nodiscard]] bool RecoverIfExpired(
        TimePoint now = Clock::now(),
        std::chrono::milliseconds timeout = std::chrono::seconds(15)) noexcept
    {
        if (!inFlight_ || now - startedAt_ < timeout) return false;
        Reset();
        return true;
    }

private:
    std::string command_;
    std::string correlationId_;
    bool inFlight_ = false;
    int sourceVersion_ = 0;
    int sourceRunId_ = 0;
    TimePoint startedAt_{};
};
}
