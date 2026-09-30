#include <algorithm>
#include <atomic>
#include <cassert>
#include <chrono>
#include <thread>
#include <mutex>
#include <vector>

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
    const auto critical = std::make_shared<std::stop_source>();
    assert(saturated.Submit(
        critical,
        lila::shared::concurrency::BackgroundTaskPriority::High,
        [] {}));
    const auto rejected = std::make_shared<std::stop_source>();
    assert(!saturated.Submit(
        rejected,
        lila::shared::concurrency::BackgroundTaskPriority::Low,
        [] {}));
    assert(rejected->stop_requested());
    const auto saturationStats = saturated.Stats();
    assert(saturationStats.queued == 2);
    assert(saturationStats.active == 1);
    assert(saturationStats.rejected == 1);
    release = true;
    saturated.Shutdown();
    assert(saturated.Stats().abandonedOnShutdown <= 2);

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

    lila::shared::concurrency::BackgroundExecutor fair({1, 16});
    std::atomic<bool> fairStarted = false;
    std::atomic<bool> fairRelease = false;
    const auto gate = std::make_shared<std::stop_source>();
    assert(fair.Submit(gate,
        lila::shared::concurrency::BackgroundTaskPriority::Normal,
        [&]
        {
            fairStarted = true;
            while (!fairRelease.load()) std::this_thread::yield();
        }));
    while (!fairStarted.load()) std::this_thread::yield();
    std::mutex orderMutex;
    std::vector<int> order;
    const auto append = [&](int value)
    {
        return [&, value]
        {
            std::scoped_lock lock(orderMutex);
            order.push_back(value);
        };
    };
    for (int value : {1, 2, 3})
        assert(fair.Submit(std::make_shared<std::stop_source>(),
            lila::shared::concurrency::BackgroundTaskPriority::High,
            append(value)));
    assert(fair.Submit(std::make_shared<std::stop_source>(),
        lila::shared::concurrency::BackgroundTaskPriority::Low, append(99)));
    fairRelease = true;
    for (int attempt = 0; attempt < 200; ++attempt)
    {
        {
            std::scoped_lock lock(orderMutex);
            if (order.size() == 4) break;
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(5));
    }
    fair.Shutdown();
    const auto low = std::find(order.begin(), order.end(), 99);
    assert(low != order.end() && std::distance(order.begin(), low) < 3);

    lila::shared::concurrency::UninstallBackgroundExecutor();
    executor.Shutdown();
}
