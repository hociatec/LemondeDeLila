#pragma once

#include <chrono>
#include <exception>
#include <mutex>
#include <stop_token>
#include <string>
#include <utility>

#include "shared/network/application/realtime/RealtimeApiClient.h"

namespace lila::shared::network::realtime::detail
{
inline constexpr const char* OperationCancelled = "WebSocket operation cancelled.";

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
}
