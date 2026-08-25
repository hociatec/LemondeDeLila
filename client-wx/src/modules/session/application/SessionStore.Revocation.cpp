#include "modules/session/application/SessionStore.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/logging/application/Logger.h"
#include "shared/security/infrastructure/SecurityUtils.h"

#include <stdexcept>
#include <utility>

namespace lila::modules::session::application
{
std::string SessionStore::DetachSession(bool onlyIfTransient)
{
    std::string refreshToken;
    {
        std::scoped_lock lock(mutex_);
        if (onlyIfTransient && persisted_)
        {
            return {};
        }

        refreshToken = std::move(current_.refreshToken);
        current_ = {};
        persisted_ = false;
        ++generation_;
        try
        {
            repository_->Clear();
        }
        catch (const std::exception& exception)
        {
            lila::shared::logging::LogWarning(
                "SessionStore",
                std::string("Failed to clear the local session: ") + exception.what());
        }
    }

    return refreshToken;
}

std::shared_ptr<lila::shared::concurrency::BackgroundTaskHandle>
SessionStore::ScheduleRevocation(
    std::string refreshToken,
    std::function<void()> completion)
{
    if (refresher_ == nullptr || refreshToken.empty())
    {
        lila::shared::security::SecureWipeString(refreshToken);
        if (completion != nullptr)
        {
            completion();
        }
        return {};
    }

    auto* refresher = refresher_.get();
    return lila::shared::concurrency::RunAsync(
        [refresher, refreshToken = std::move(refreshToken)](std::stop_token stopToken) mutable
        {
            try
            {
                if (!refresher->Revoke(refreshToken, stopToken)
                    && !stopToken.stop_requested())
                {
                    lila::shared::logging::LogWarning(
                        "SessionStore",
                        "Refresh token revocation could not be confirmed.");
                }
            }
            catch (const std::exception& exception)
            {
                if (!stopToken.stop_requested())
                {
                    lila::shared::logging::LogWarning(
                        "SessionStore",
                        std::string("Refresh token revocation failed: ") + exception.what());
                }
            }
            lila::shared::security::SecureWipeString(refreshToken);
        },
        [completion = std::move(completion)](std::optional<lila::shared::errors::AppError>)
        {
            if (completion != nullptr)
            {
                completion();
            }
        },
        lila::shared::concurrency::BackgroundTaskPriority::High);
}
}

