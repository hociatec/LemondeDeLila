#include "shared/concurrency/application/BackgroundExecutor.h"

#include <stdexcept>
#include <utility>

namespace lila::shared::concurrency
{
namespace
{
BackgroundExecutor* g_installedExecutor = nullptr;
}

void InstallBackgroundExecutor(BackgroundExecutor& executor)
{
    g_installedExecutor = &executor;
}

void UninstallBackgroundExecutor()
{
    g_installedExecutor = nullptr;
}

BackgroundExecutor& CurrentBackgroundExecutor()
{
    if (g_installedExecutor == nullptr)
    {
        throw std::runtime_error("No installed BackgroundExecutor.");
    }

    return *g_installedExecutor;
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

std::shared_ptr<BackgroundTaskHandle> RunAsync(
    std::function<void(std::stop_token)> worker,
    std::function<void(std::optional<lila::shared::errors::AppError>)> completion,
    BackgroundTaskPriority priority,
    std::string userMessageOnFailure)
{
    return RunAsync<bool>(
        [worker = std::move(worker)](std::stop_token stopToken)
        {
            worker(stopToken);
            return true;
        },
        [completion = std::move(completion)](
            std::optional<lila::shared::errors::AppError> error,
            std::optional<bool>) mutable
        {
            if (completion) completion(std::move(error));
        },
        priority,
        std::move(userMessageOnFailure));
}

std::shared_ptr<BackgroundTaskHandle> RunAsync(
    std::function<void()> worker,
    std::function<void(std::optional<lila::shared::errors::AppError>)> completion,
    BackgroundTaskPriority priority,
    std::string userMessageOnFailure)
{
    return RunAsync(
        [worker = std::move(worker)](std::stop_token)
        {
            worker();
        },
        std::move(completion),
        priority,
        std::move(userMessageOnFailure));
}
}
