#include "shared/concurrency/BackgroundExecutor.h"
#include "shared/errors/ErrorMessages.h"

namespace lila::shared::concurrency
{
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
    std::function<void(std::string)> completion)
{
    auto stopSource = std::make_shared<std::stop_source>();
    const auto handle = std::make_shared<BackgroundTaskHandle>(stopSource);
    std::thread(
        [worker = std::move(worker), stopSource, completion = std::move(completion)]() mutable
        {
            std::string errorMessage;
            try
            {
                worker(stopSource->get_token());
            }
            catch (const std::exception& error)
            {
                errorMessage = error.what();
            }
            catch (...)
            {
                errorMessage = lila::shared::errors::UnexpectedError;
            }

            if (completion != nullptr)
            {
                completion(std::move(errorMessage));
            }
        })
        .detach();

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
