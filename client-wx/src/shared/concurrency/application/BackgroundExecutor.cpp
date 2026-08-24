#include "shared/concurrency/application/BackgroundExecutor.h"

#include "shared/logging/application/Logger.h"

#include <algorithm>
#include <array>
#include <condition_variable>
#include <deque>
#include <mutex>
#include <stdexcept>
#include <thread>
#include <utility>
#include <vector>

namespace lila::shared::concurrency
{
namespace
{
std::size_t ResolveWorkerCount(std::size_t configuredCount)
{
    if (configuredCount > 0)
    {
        return configuredCount;
    }

    const unsigned int hardwareThreads = std::thread::hardware_concurrency();
    return hardwareThreads == 0 ? 2U : static_cast<std::size_t>(hardwareThreads);
}

std::size_t PriorityIndex(BackgroundTaskPriority priority)
{
    switch (priority)
    {
    case BackgroundTaskPriority::High:
        return 0;
    case BackgroundTaskPriority::Normal:
        return 1;
    case BackgroundTaskPriority::Low:
        return 2;
    }

    return 1;
}
}

struct BackgroundExecutor::Impl final
{
    struct Job final
    {
        std::shared_ptr<std::stop_source> stopSource;
        std::function<void()> work;
    };

    explicit Impl(BackgroundExecutorOptions options)
        : queueCapacity(options.queueCapacity == 0 ? 256 : options.queueCapacity)
    {
        const std::size_t workerCount = ResolveWorkerCount(options.workerCount);
        workers.reserve(workerCount);
        for (std::size_t index = 0; index < workerCount; ++index)
        {
            workers.emplace_back([this]() { WorkerLoop(); });
        }
    }

    ~Impl()
    {
        Shutdown();
    }

    void Submit(
        std::shared_ptr<std::stop_source> stopSource,
        BackgroundTaskPriority priority,
        std::function<void()> work)
    {
        if (stopSource == nullptr || work == nullptr)
        {
            return;
        }

        {
            std::lock_guard lock(mutex);
            if (stopping)
            {
                stopSource->request_stop();
                return;
            }

            if (QueueSizeUnsafe() >= queueCapacity)
            {
                lila::shared::logging::LogWarning("BackgroundExecutor", "Queue capacity reached. Dropping job.");
                stopSource->request_stop();
                return;
            }

            queues[PriorityIndex(priority)].push_back(Job{std::move(stopSource), std::move(work)});
        }

        condition.notify_one();
    }

    void Shutdown()
    {
        std::vector<std::thread> threadsToJoin;
        {
            std::lock_guard lock(mutex);
            if (stopping && workers.empty())
            {
                return;
            }

            stopping = true;
            for (auto& queue : queues)
            {
                for (auto& job : queue)
                {
                    job.stopSource->request_stop();
                }
                queue.clear();
            }

            for (const auto& source : activeStopSources)
            {
                if (source != nullptr)
                {
                    source->request_stop();
                }
            }

            threadsToJoin.swap(workers);
        }

        condition.notify_all();
        for (auto& worker : threadsToJoin)
        {
            if (worker.joinable())
            {
                worker.join();
            }
        }
    }

    void WorkerLoop()
    {
        while (true)
        {
            Job job;
            {
                std::unique_lock lock(mutex);
                condition.wait(lock, [this]() { return stopping || QueueSizeUnsafe() > 0; });
                if (stopping && QueueSizeUnsafe() == 0)
                {
                    return;
                }

                job = PopNextUnsafe();
                activeStopSources.push_back(job.stopSource);
            }

            if (!job.stopSource->stop_requested())
            {
                job.work();
            }

            {
                std::lock_guard lock(mutex);
                const auto iterator = std::find(activeStopSources.begin(), activeStopSources.end(), job.stopSource);
                if (iterator != activeStopSources.end())
                {
                    activeStopSources.erase(iterator);
                }
            }
        }
    }

    [[nodiscard]] std::size_t QueueSizeUnsafe() const
    {
        return queues[0].size() + queues[1].size() + queues[2].size();
    }

    Job PopNextUnsafe()
    {
        for (auto& queue : queues)
        {
            if (!queue.empty())
            {
                Job job = std::move(queue.front());
                queue.pop_front();
                return job;
            }
        }

        throw std::runtime_error("BackgroundExecutor queue unexpectedly empty.");
    }

    const std::size_t queueCapacity;
    std::mutex mutex;
    std::condition_variable condition;
    std::array<std::deque<Job>, 3> queues;
    std::vector<std::shared_ptr<std::stop_source>> activeStopSources;
    std::vector<std::thread> workers;
    bool stopping = false;
};

BackgroundExecutor::BackgroundExecutor(BackgroundExecutorOptions options)
    : impl_(std::make_unique<Impl>(options))
{
}

BackgroundExecutor::~BackgroundExecutor() = default;

void BackgroundExecutor::Submit(
    std::shared_ptr<std::stop_source> stopSource,
    BackgroundTaskPriority priority,
    std::function<void()> work)
{
    impl_->Submit(std::move(stopSource), priority, std::move(work));
}

void BackgroundExecutor::Shutdown()
{
    impl_->Shutdown();
}

}
