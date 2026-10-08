#pragma once

#include <atomic>
#include <chrono>
#include <functional>
#include <future>
#include <memory>
#include <thread>
#include <utility>

namespace lila::shared::accessibility
{
// Third-party synchronous RPC can outlive the caller indefinitely. Isolate it
// from the application's joined workers and allow at most one outstanding call.
// Actions must own their arguments and DLL lifetime; never capture UI objects.
class ScreenReaderCallGate final
{
public:
    bool Invoke(std::chrono::milliseconds timeout, std::function<bool()> action) const noexcept
    {
        if (busy_->exchange(true)) return false;
        bool started = false;
        try
        {
            auto task = std::make_shared<std::packaged_task<bool()>>(
                [busy = busy_, action = std::move(action)]()
                {
                    struct Release final
                    {
                        std::shared_ptr<std::atomic_bool> busy;
                        ~Release() { busy->store(false); }
                    } release{busy};
                    return action();
                });
            auto result = task->get_future();
            // Only this self-contained external call is detached. Its captured
            // ownership survives timeout, shutdown and destruction of the gate.
            std::thread([task] { (*task)(); }).detach();
            started = true;
            return result.wait_for(timeout) == std::future_status::ready && result.get();
        }
        catch (...)
        {
            if (!started) busy_->store(false);
            return false;
        }
    }

private:
    std::shared_ptr<std::atomic_bool> busy_ = std::make_shared<std::atomic_bool>(false);
};
}
