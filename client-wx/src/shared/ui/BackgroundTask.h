#pragma once

#include <functional>
#include <optional>
#include <string>

#include <wx/app.h>
#include <wx/weakref.h>
#include <wx/window.h>

#include "shared/concurrency/BackgroundExecutor.h"
#include "shared/logging/Logger.h"

namespace lila::shared::ui
{
inline constexpr const char* UnexpectedErrorMessage = lila::shared::errors::UnexpectedError;

inline std::shared_ptr<lila::shared::concurrency::BackgroundTaskHandle> RunBackgroundTask(
    wxWindow* owner,
    std::function<void()> worker,
    std::function<void(std::string)> completion,
    const char* failureMessage = UnexpectedErrorMessage,
    lila::shared::concurrency::BackgroundTaskPriority priority = lila::shared::concurrency::BackgroundTaskPriority::Normal)
{
    return lila::shared::concurrency::RunAsync(
        std::move(worker),
        [owner = wxWeakRef<wxWindow>(owner), completion = std::move(completion)](
            std::optional<lila::shared::errors::AppError> error) mutable
        {
            if (error.has_value() && !error->DiagnosticDetails().empty())
            {
                lila::shared::logging::LogError("BackgroundTask", error->DiagnosticDetails());
            }

            if (wxTheApp == nullptr)
            {
                return;
            }

            wxTheApp->CallAfter(
                [owner,
                 completion = std::move(completion),
                 userMessage = error.has_value() ? error->UserMessage() : std::string()]() mutable
                {
                    if (!owner || !completion)
                    {
                        return;
                    }

                    completion(std::move(userMessage));
                });
        },
        priority,
        failureMessage);
}

template <typename TResult>
inline std::shared_ptr<lila::shared::concurrency::BackgroundTaskHandle> RunBackgroundTaskWithResult(
    wxWindow* owner,
    std::function<TResult()> worker,
    std::function<void(std::string, std::optional<TResult>)> completion,
    const char* failureMessage = UnexpectedErrorMessage,
    lila::shared::concurrency::BackgroundTaskPriority priority = lila::shared::concurrency::BackgroundTaskPriority::Normal)
{
    return lila::shared::concurrency::RunAsync<TResult>(
        [worker = std::move(worker)](std::stop_token)
        {
            return worker();
        },
        [owner = wxWeakRef<wxWindow>(owner), completion = std::move(completion)](
            std::optional<lila::shared::errors::AppError> error,
            std::optional<TResult> result) mutable
        {
            if (error.has_value() && !error->DiagnosticDetails().empty())
            {
                lila::shared::logging::LogError("BackgroundTask", error->DiagnosticDetails());
            }

            if (wxTheApp == nullptr)
            {
                return;
            }

            wxTheApp->CallAfter(
                [owner,
                 completion = std::move(completion),
                 userMessage = error.has_value() ? error->UserMessage() : std::string(),
                 result = std::move(result)]() mutable
                {
                    if (!owner || !completion)
                    {
                        return;
                    }

                    completion(std::move(userMessage), std::move(result));
                });
        },
        priority,
        failureMessage);
}
}
