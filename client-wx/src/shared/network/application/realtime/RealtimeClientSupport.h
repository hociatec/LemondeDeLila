#pragma once

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <exception>
#include <mutex>
#include <stop_token>
#include <string>
#include <thread>
#include <utility>

#include "shared/network/application/realtime/RealtimeApiClient.h"
#include "shared/network/application/websocket/IWebSocketClient.h"

namespace lila::shared::network::realtime::detail
{
inline constexpr const char* OperationCancelled = "WebSocket operation cancelled.";
inline constexpr const char* OperationTimedOut = "WebSocket request timed out.";

class RealtimeRequestDeadline final
{
public:
    RealtimeRequestDeadline(
        websocket::IWebSocketClient& client,
        std::chrono::milliseconds timeout)
        : client_(client), worker_([this, timeout](std::stop_token stopToken)
        {
            std::unique_lock lock(mutex_);
            static_cast<void>(condition_.wait_for(
                lock, stopToken, timeout, []() { return false; }));
            if (stopToken.stop_requested()) return;
            timedOut_.store(true, std::memory_order_release);
            lock.unlock();
            client_.CancelPendingOperation();
        })
    {
    }

    ~RealtimeRequestDeadline()
    {
        worker_.request_stop();
        condition_.notify_all();
        if (worker_.joinable()) worker_.join();
    }

    RealtimeRequestDeadline(const RealtimeRequestDeadline&) = delete;
    RealtimeRequestDeadline& operator=(const RealtimeRequestDeadline&) = delete;

    [[nodiscard]] bool TimedOut() const noexcept
    {
        return timedOut_.load(std::memory_order_acquire);
    }

private:
    websocket::IWebSocketClient& client_;
    std::atomic_bool timedOut_ = false;
    std::mutex mutex_;
    std::condition_variable_any condition_;
    std::jthread worker_;
};

[[nodiscard]] inline RealtimeApiResponse ErrorResponse(
    const std::string& type,
    RealtimeErrorKind kind,
    std::string message,
    unsigned long statusCode = 0)
{
    RealtimeApiResponse response;
    response.type = type;
    response.errorKind = kind;
    response.statusCode = statusCode;
    response.errorMessage = std::move(message);
    return response;
}

[[nodiscard]] inline bool AcquireRequestLock(
    std::unique_lock<std::timed_mutex>& lock,
    std::stop_token stopToken)
{
    while (!lock.try_lock_for(std::chrono::milliseconds(25)))
    {
        if (stopToken.stop_requested()) return false;
    }
    return true;
}

[[nodiscard]] inline RealtimeApiResponse TransportErrorResponse(
    const std::string& type,
    std::stop_token stopToken,
    const std::exception& exception)
{
    return ErrorResponse(
        type,
        stopToken.stop_requested() ? RealtimeErrorKind::Cancelled : RealtimeErrorKind::Transport,
        exception.what());
}

[[nodiscard]] inline RealtimeApiResponse DeadlineErrorResponse(
    const std::string& type,
    std::stop_token stopToken,
    bool timedOut,
    const std::exception& exception)
{
    if (timedOut && !stopToken.stop_requested())
        return ErrorResponse(type, RealtimeErrorKind::Transport, OperationTimedOut);
    return TransportErrorResponse(type, stopToken, exception);
}
}
