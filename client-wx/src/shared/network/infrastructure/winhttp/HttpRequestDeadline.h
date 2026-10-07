#pragma once
#ifdef _WIN32
#include <chrono>
#include <condition_variable>
#include <mutex>
#include <thread>
#include "shared/network/infrastructure/winhttp/WinHttpHandle.h"

namespace lila::shared::network::winhttp
{
class HttpRequestDeadline final
{
public:
    explicit HttpRequestDeadline(Handle& request, std::chrono::milliseconds duration)
        : timer_([&request, duration](std::stop_token stop)
        {
            std::mutex mutex;
            std::condition_variable_any wake;
            std::unique_lock lock(mutex);
            wake.wait_for(lock, stop, duration, [] { return false; });
            if (!stop.stop_requested()) request.Reset();
        }) {}
private:
    std::jthread timer_;
};
}
#endif
