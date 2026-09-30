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
#include "shared/errors/catalog/CoreErrorMessages.h"
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

struct BackgroundExecutorStats final
{
    std::size_t queued = 0;
    std::size_t active = 0;
    std::size_t rejected = 0;
    std::size_t abandonedOnShutdown = 0;
};

class BackgroundTaskHandle final
{
public:
    explicit BackgroundTaskHandle(std::shared_ptr<std::stop_source> stopSource);
    void RequestCancel();
    [[nodiscard]] bool IsCancellationRequested() const;
    [[nodiscard]] bool WasAccepted() const noexcept;
    void MarkAccepted() noexcept;

private:
    std::shared_ptr<std::stop_source> stopSource_;
    bool accepted_ = false;
};

class BackgroundExecutor final
{
public:
    explicit BackgroundExecutor(BackgroundExecutorOptions options = {});
    ~BackgroundExecutor();

    BackgroundExecutor(const BackgroundExecutor&) = delete;
    BackgroundExecutor& operator=(const BackgroundExecutor&) = delete;

    [[nodiscard]] bool Submit(
        std::shared_ptr<std::stop_source> stopSource,
        BackgroundTaskPriority priority,
        std::function<void()> work);
    void Shutdown();
    [[nodiscard]] BackgroundExecutorStats Stats() const;

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

    const bool accepted = CurrentBackgroundExecutor().Submit(
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
            catch (...)
            {
                error = lila::shared::errors::ToAppError(
                    userMessageOnFailure, "Erreur de tâche inconnue.");
            }

            if (completion != nullptr && !stopSource->stop_requested())
            {
                completion(std::move(error), std::move(result));
            }
        });

    if (accepted) handle->MarkAccepted();

    return handle;
}

[[nodiscard]] std::shared_ptr<BackgroundTaskHandle> RunAsync(
    std::function<void()> worker,
    std::function<void(std::optional<lila::shared::errors::AppError>)> completion = {},
    BackgroundTaskPriority priority = BackgroundTaskPriority::Normal,
    std::string userMessageOnFailure = lila::shared::errors::UnexpectedError);
}
