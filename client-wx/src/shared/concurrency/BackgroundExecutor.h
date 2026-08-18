#pragma once

#include <exception>
#include <functional>
#include <memory>
#include <optional>
#include <stop_token>
#include <string>
#include <utility>

#include "shared/errors/ErrorMessages.h"

namespace lila::shared::concurrency
{
class BackgroundTaskHandle final
{
public:
    explicit BackgroundTaskHandle(std::shared_ptr<std::stop_source> stopSource);
    void RequestCancel();
    [[nodiscard]] bool IsCancellationRequested() const;

private:
    std::shared_ptr<std::stop_source> stopSource_;
};

namespace detail
{
void SubmitBackgroundWork(
    std::shared_ptr<std::stop_source> stopSource,
    std::function<void()> work);
}

// Stops accepting work, requests cooperative cancellation for queued/running work,
// and joins the shared workers. Call this before destroying services captured by jobs.
void ShutdownBackgroundExecutor();

[[nodiscard]] std::shared_ptr<BackgroundTaskHandle> RunAsync(
    std::function<void(std::stop_token)> worker,
    std::function<void(std::string)> completion = {});

template <typename TResult>
[[nodiscard]] inline std::shared_ptr<BackgroundTaskHandle> RunAsync(
    std::function<TResult(std::stop_token)> worker,
    std::function<void(std::string, std::optional<TResult>)> completion)
{
    auto stopSource = std::make_shared<std::stop_source>();
    const auto handle = std::make_shared<BackgroundTaskHandle>(stopSource);

    detail::SubmitBackgroundWork(
        stopSource,
        [worker = std::move(worker), stopSource, completion = std::move(completion)]() mutable
        {
            std::string errorMessage;
            std::optional<TResult> result;
            try
            {
                if (!stopSource->stop_requested())
                {
                    result = worker(stopSource->get_token());
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
                completion(std::move(errorMessage), std::move(result));
            }
        });

    return handle;
}

[[nodiscard]] std::shared_ptr<BackgroundTaskHandle> RunAsync(
    std::function<void()> worker,
    std::function<void(std::string)> completion = {});
}
