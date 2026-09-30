#include <atomic>
#include <cassert>
#include <chrono>
#include <thread>

#include "shared/concurrency/application/BackgroundExecutor.h"

int main()
{
    lila::shared::concurrency::BackgroundExecutor executor({1, 16});
    lila::shared::concurrency::InstallBackgroundExecutor(executor);

    std::atomic<bool> completed = false;
    auto handle = lila::shared::concurrency::RunAsync(
        [&completed](std::stop_token)
        {
            completed = true;
        });

    for (int attempt = 0; attempt < 100 && !completed; ++attempt)
    {
        std::this_thread::sleep_for(std::chrono::milliseconds(5));
    }

    assert(handle != nullptr);
    assert(handle->WasAccepted());
    assert(completed);

    lila::shared::concurrency::BackgroundExecutor saturated({1, 1});
    std::atomic<bool> started = false;
    std::atomic<bool> release = false;
    const auto running = std::make_shared<std::stop_source>();
    assert(saturated.Submit(
        running,
        lila::shared::concurrency::BackgroundTaskPriority::Normal,
        [&started, &release]
        {
            started = true;
            while (!release.load()) std::this_thread::yield();
        }));
    while (!started.load()) std::this_thread::yield();
    const auto queued = std::make_shared<std::stop_source>();
    assert(saturated.Submit(
        queued,
        lila::shared::concurrency::BackgroundTaskPriority::Normal,
        [] {}));
    const auto rejected = std::make_shared<std::stop_source>();
    assert(!saturated.Submit(
        rejected,
        lila::shared::concurrency::BackgroundTaskPriority::High,
        [] {}));
    assert(rejected->stop_requested());
    release = true;
    saturated.Shutdown();

    lila::shared::concurrency::BackgroundExecutor exceptional({1, 2});
    const auto throwing = std::make_shared<std::stop_source>();
    assert(exceptional.Submit(
        throwing,
        lila::shared::concurrency::BackgroundTaskPriority::Normal,
        [] { throw 42; }));
    for (int attempt = 0; attempt < 100 && !throwing->stop_requested(); ++attempt)
        std::this_thread::sleep_for(std::chrono::milliseconds(5));
    assert(throwing->stop_requested());
    exceptional.Shutdown();

    lila::shared::concurrency::UninstallBackgroundExecutor();
    executor.Shutdown();
}
