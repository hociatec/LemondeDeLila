#pragma once

#include <cstddef>
#include <functional>
#include <exception>
#include <memory>
#include <optional>
#include <stop_token>
#include <string>
#include <utility>

#include "shared/errors/domain/AppError.h"
#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/logging/application/Logger.h"

namespace lila::shared::concurrency
{
enum class BackgroundTaskPriority
{
    High,
    Normal,
    Low
};

struct BackgroundExecutorOptions final
{
    std::size_t workerCount = 0;
    std::size_t queueCapacity = 256;
};

class BackgroundTaskHandle final
{
public:
    explicit BackgroundTaskHandle(std::shared_ptr<std::stop_source> stopSource);
    void RequestCancel();
    [[nodiscard]] bool IsCancellationRequested() const;

private:
    std::shared_ptr<std::stop_source> stopSource_;
};

class BackgroundExecutor final
{
public:
    explicit BackgroundExecutor(BackgroundExecutorOptions options = {});
    ~BackgroundExecutor();

    BackgroundExecutor(const BackgroundExecutor&) = delete;
    BackgroundExecutor& operator=(const BackgroundExecutor&) = delete;

    void Submit(
        std::shared_ptr<std::stop_source> stopSource,
        BackgroundTaskPriority priority,
        std::function<void()> work);
    void Shutdown();

private:
    struct Impl;
    std::unique_ptr<Impl> impl_;
};

void InstallBackgroundExecutor(BackgroundExecutor& executor);
void UninstallBackgroundExecutor();
[[nodiscard]] BackgroundExecutor& CurrentBackgroundExecutor();

[[nodiscard]] std::shared_ptr<BackgroundTaskHandle> RunAsync(
    std::function<void(std::stop_token)> worker,
    std::function<void(std::optional<lila::shared::errors::AppError>)> completion = {},
    BackgroundTaskPriority priority = BackgroundTaskPriority::Normal,
    std::string userMessageOnFailure = lila::shared::errors::UnexpectedError);

template <typename TResult>
[[nodiscard]] inline std::shared_ptr<BackgroundTaskHandle> RunAsync(
    std::function<TResult(std::stop_token)> worker,
    std::function<void(std::optional<lila::shared::errors::AppError>, std::optional<TResult>)> completion,
    BackgroundTaskPriority priority = BackgroundTaskPriority::Normal,
    std::string userMessageOnFailure = lila::shared::errors::UnexpectedError)
{
    auto stopSource = std::make_shared<std::stop_source>();
    const auto handle = std::make_shared<BackgroundTaskHandle>(stopSource);

    CurrentBackgroundExecutor().Submit(
        stopSource,
        priority,
        [worker = std::move(worker),
         stopSource,
         completion = std::move(completion),
         userMessageOnFailure = std::move(userMessageOnFailure)]() mutable
        {
            std::optional<lila::shared::errors::AppError> error;
            std::optional<TResult> result;

            try
            {
                if (!stopSource->stop_requested())
                {
                    result = worker(stopSource->get_token());
                }
            }
            catch (const std::exception& exception)
            {
                error = lila::shared::errors::ToAppError(exception, userMessageOnFailure);
            }

            if (completion != nullptr && !stopSource->stop_requested())
            {
                completion(std::move(error), std::move(result));
            }
        });

    return handle;
}

[[nodiscard]] std::shared_ptr<BackgroundTaskHandle> RunAsync(
    std::function<void()> worker,
    std::function<void(std::optional<lila::shared::errors::AppError>)> completion = {},
    BackgroundTaskPriority priority = BackgroundTaskPriority::Normal,
    std::string userMessageOnFailure = lila::shared::errors::UnexpectedError);
}
