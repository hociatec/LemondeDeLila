#pragma once

#include <functional>
#include <optional>
#include <string>

#include <wx/app.h>
#include <wx/weakref.h>
#include <wx/window.h>

#include "shared/concurrency/BackgroundExecutor.h"
#include "shared/errors/ErrorMessages.h"

namespace lila::shared::ui {

inline constexpr const char* UnexpectedErrorMessage = lila::shared::errors::UnexpectedError;

inline void RunDetachedBackgroundTask(std::function<void()> worker)
{
    static_cast<void>(lila::shared::concurrency::RunAsync(std::move(worker)));
}

inline void RunBackgroundTask(
    wxWindow* owner,
    std::function<void()> worker,
    std::function<void(std::string)> completion)
{
    static_cast<void>(lila::shared::concurrency::RunAsync(
        [worker = std::move(worker)](std::stop_token)
        {
            worker();
        },
        [owner = wxWeakRef<wxWindow>(owner), completion = std::move(completion)](std::string errorMessage) mutable
        {
            if (wxTheApp == nullptr)
            {
                return;
            }

            wxTheApp->CallAfter(
                [owner, completion = std::move(completion), errorMessage = std::move(errorMessage)]() mutable
                {
                    if (!owner || !completion)
                    {
                        return;
                    }

                    completion(std::move(errorMessage));
                });
        }));
}

template <typename TResult>
inline void RunBackgroundTaskWithResult(
    wxWindow* owner,
    std::function<TResult()> worker,
    std::function<void(std::string, std::optional<TResult>)> completion)
{
    static_cast<void>(lila::shared::concurrency::RunAsync<TResult>(
        [worker = std::move(worker)](std::stop_token)
        {
            return worker();
        },
        [owner = wxWeakRef<wxWindow>(owner), completion = std::move(completion)](
            std::string errorMessage,
            std::optional<TResult> result) mutable
        {
            if (wxTheApp == nullptr)
            {
                return;
            }

            wxTheApp->CallAfter(
                [owner,
                 completion = std::move(completion),
                 errorMessage = std::move(errorMessage),
                 result = std::move(result)]() mutable
                {
                    if (!owner || !completion)
                    {
                        return;
                    }

                    completion(std::move(errorMessage), std::move(result));
                });
        }));
}

}
