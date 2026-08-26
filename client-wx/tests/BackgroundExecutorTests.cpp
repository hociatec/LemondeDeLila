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
    assert(completed);

    lila::shared::concurrency::UninstallBackgroundExecutor();
    executor.Shutdown();
}
