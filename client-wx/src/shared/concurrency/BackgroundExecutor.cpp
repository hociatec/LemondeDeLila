#include "shared/concurrency/BackgroundExecutor.h"

#include <algorithm>
#include <condition_variable>
#include <cstddef>
#include <deque>
#include <mutex>
#include <thread>
#include <utility>
#include <vector>

namespace lila::shared::concurrency
{
namespace
{
class BackgroundWorkerPool final
{
public:
    BackgroundWorkerPool()
    {
        const unsigned int hardwareThreads = std::thread::hardware_concurrency();
        const std::size_t workerCount = std::clamp<std::size_t>(hardwareThreads == 0 ? 2U : hardwareThreads, 2U, 4U);
        workers_.reserve(workerCount);
        for (std::size_t index = 0; index < workerCount; ++index)
        {
            workers_.emplace_back([this]() { WorkerLoop(); });
        }
    }

    ~BackgroundWorkerPool()
    {
        Shutdown();
    }

    void Submit(std::shared_ptr<std::stop_source> stopSource, std::function<void()> work)
    {
        if (stopSource == nullptr || work == nullptr)
        {
            return;
        }

        {
            std::lock_guard lock(mutex_);
            if (stopping_)
            {
                stopSource->request_stop();
                return;
            }

            queue_.push_back(Job{std::move(stopSource), std::move(work)});
        }
        condition_.notify_one();
    }

    void Shutdown()
    {
        std::vector<std::thread> workers;
        {
            std::lock_guard lock(mutex_);
            if (stopping_ && workers_.empty())
            {
                return;
            }

            stopping_ = true;
            for (auto& job : queue_)
            {
                job.stopSource->request_stop();
            }
            queue_.clear();

            for (const auto& source : activeStopSources_)
            {
                if (source != nullptr)
                {
                    source->request_stop();
                }
            }

            workers.swap(workers_);
        }

        condition_.notify_all();
        for (auto& worker : workers)
        {
            if (worker.joinable())
            {
                worker.join();
            }
        }
    }

private:
    struct Job final
    {
        std::shared_ptr<std::stop_source> stopSource;
        std::function<void()> work;
    };

    void WorkerLoop()
    {
        while (true)
        {
            Job job;
            {
                std::unique_lock lock(mutex_);
                condition_.wait(lock, [this]() { return stopping_ || !queue_.empty(); });
                if (stopping_ && queue_.empty())
                {
                    return;
                }

                job = std::move(queue_.front());
                queue_.pop_front();
                activeStopSources_.push_back(job.stopSource);
            }

            if (!job.stopSource->stop_requested())
            {
                job.work();
            }

            {
                std::lock_guard lock(mutex_);
                const auto iterator = std::find(activeStopSources_.begin(), activeStopSources_.end(), job.stopSource);
                if (iterator != activeStopSources_.end())
                {
                    activeStopSources_.erase(iterator);
                }
            }
        }
    }

    std::mutex mutex_;
    std::condition_variable condition_;
    std::deque<Job> queue_;
    std::vector<std::shared_ptr<std::stop_source>> activeStopSources_;
    std::vector<std::thread> workers_;
    bool stopping_ = false;
};

BackgroundWorkerPool& WorkerPool()
{
    static BackgroundWorkerPool pool;
    return pool;
}
}

BackgroundTaskHandle::BackgroundTaskHandle(std::shared_ptr<std::stop_source> stopSource)
    : stopSource_(std::move(stopSource))
{
}

void BackgroundTaskHandle::RequestCancel()
{
    if (stopSource_ != nullptr)
    {
        stopSource_->request_stop();
    }
}

bool BackgroundTaskHandle::IsCancellationRequested() const
{
    return stopSource_ != nullptr && stopSource_->stop_requested();
}

namespace detail
{
void SubmitBackgroundWork(
    std::shared_ptr<std::stop_source> stopSource,
    std::function<void()> work)
{
    WorkerPool().Submit(std::move(stopSource), std::move(work));
}
}

void ShutdownBackgroundExecutor()
{
    WorkerPool().Shutdown();
}

std::shared_ptr<BackgroundTaskHandle> RunAsync(
    std::function<void(std::stop_token)> worker,
    std::function<void(std::string)> completion)
{
    auto stopSource = std::make_shared<std::stop_source>();
    const auto handle = std::make_shared<BackgroundTaskHandle>(stopSource);

    detail::SubmitBackgroundWork(
        stopSource,
        [worker = std::move(worker), stopSource, completion = std::move(completion)]() mutable
        {
            std::string errorMessage;
            try
            {
                if (!stopSource->stop_requested())
                {
                    worker(stopSource->get_token());
                }
            }
            catch (const std::exception& error)
            {
                errorMessage = error.what();
            }
            catch (...)
            {
                errorMessage = lila::shared::errors::UnexpectedError;
            }

            if (completion != nullptr && !stopSource->stop_requested())
            {
                completion(std::move(errorMessage));
            }
        });

    return handle;
}

std::shared_ptr<BackgroundTaskHandle> RunAsync(
    std::function<void()> worker,
    std::function<void(std::string)> completion)
{
    return RunAsync(
        [worker = std::move(worker)](std::stop_token)
        {
            worker();
        },
        std::move(completion));
}
}
