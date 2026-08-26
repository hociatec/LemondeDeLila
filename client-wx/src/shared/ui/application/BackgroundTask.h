#pragma once

#include <functional>
#include <optional>
#include <string>
#include <utility>

#include <wx/app.h>
#include <wx/weakref.h>
#include <wx/window.h>

#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/logging/application/Logger.h"

namespace lila::shared::ui
{
inline constexpr const char* UnexpectedErrorMessage = lila::shared::errors::UnexpectedError;

inline void LogBackgroundTaskError(
    const std::optional<lila::shared::errors::AppError>& error)
{
    if (error.has_value() && !error->DiagnosticDetails().empty())
        lila::shared::logging::LogError("BackgroundTask", error->DiagnosticDetails());
}

template <typename Completion>
inline void ScheduleOwnedUiCompletion(wxWeakRef<wxWindow> owner, Completion&& completion)
{
    if (wxTheApp == nullptr) return;
    wxTheApp->CallAfter(
        [owner, completion = std::forward<Completion>(completion)]() mutable
        {
            if (owner) completion();
        });
}

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
            LogBackgroundTaskError(error);
            ScheduleOwnedUiCompletion(
                owner,
                [completion = std::move(completion),
                 userMessage = error.has_value() ? error->UserMessage() : std::string()]() mutable
                {
                    if (completion) completion(std::move(userMessage));
                });
        },
        priority,
        failureMessage);
}

template <typename Owner, typename Finished, typename Failed, typename Succeeded>
inline std::shared_ptr<lila::shared::concurrency::BackgroundTaskHandle> RunManagedBackgroundTask(
    Owner& owner,
    std::function<void()> worker,
    Finished&& finished,
    Failed&& failed,
    Succeeded&& succeeded,
    const char* failureMessage = UnexpectedErrorMessage)
{
    return RunBackgroundTask(
        &owner,
        std::move(worker),
        [weakOwner = wxWeakRef<Owner>(&owner),
         finished = std::forward<Finished>(finished),
         failed = std::forward<Failed>(failed),
         succeeded = std::forward<Succeeded>(succeeded)](std::string errorMessage) mutable
        {
            auto* liveOwner = weakOwner.get();
            if (liveOwner == nullptr) return;
            finished(*liveOwner);
            if (!errorMessage.empty())
            {
                failed(*liveOwner, std::move(errorMessage));
                return;
            }
            succeeded(*liveOwner);
        },
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
            LogBackgroundTaskError(error);
            ScheduleOwnedUiCompletion(
                owner,
                [completion = std::move(completion),
                 userMessage = error.has_value() ? error->UserMessage() : std::string(),
                 result = std::move(result)]() mutable
                {
                    if (completion) completion(std::move(userMessage), std::move(result));
                });
        },
        priority,
        failureMessage);
}
}
