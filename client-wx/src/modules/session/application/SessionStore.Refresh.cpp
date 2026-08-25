#include "modules/session/application/SessionStore.h"
#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/logging/application/Logger.h"
#include "shared/security/infrastructure/SecurityUtils.h"

#include <ctime>
#include <stdexcept>
#include <utility>

namespace lila::modules::session::application
{
std::string SessionStore::AccessToken(std::stop_token stopToken)
{
    std::uint64_t observedGeneration = 0;
    {
        std::scoped_lock lock(mutex_);
        if (!HasSessionLocked())
        {
            throw std::runtime_error(lila::shared::errors::NoActiveSession);
        }
        observedGeneration = generation_;

        constexpr std::int64_t RefreshSkewSeconds = 60;
        const auto now = static_cast<std::int64_t>(std::time(nullptr));
        const bool shouldRefresh = current_.expiresAt > 0
            && current_.expiresAt <= now + RefreshSkewSeconds
            && !current_.refreshToken.empty()
            && refresher_ != nullptr;
        if (!shouldRefresh && current_.IsAuthenticated())
        {
            return current_.token;
        }
    }

    try
    {
        return RefreshAccessToken(stopToken);
    }
    catch (...)
    {
        std::scoped_lock lock(mutex_);
        if (generation_ == observedGeneration && current_.IsAuthenticated())
        {
            return current_.token;
        }
        throw;
    }
}

std::string SessionStore::RefreshAccessToken(std::stop_token stopToken)
{
    std::string refreshToken;
    std::uint64_t refreshGeneration = 0;
    {
        std::unique_lock lock(mutex_);
        const auto requestedGeneration = generation_;
        if (refreshInProgress_)
        {
            const bool completed = refreshCondition_.wait(
                lock,
                stopToken,
                [this]() { return !refreshInProgress_; });
            if (!completed)
            {
                throw std::runtime_error("Renouvellement de session interrompu.");
            }
            if (generation_ != requestedGeneration)
            {
                throw std::runtime_error(lila::shared::errors::NoActiveSession);
            }
            if (!HasSessionLocked())
            {
                throw std::runtime_error(lila::shared::errors::NoActiveSession);
            }
            if (lastSuccessfulRefreshGeneration_ == requestedGeneration
                && current_.IsAuthenticated())
            {
                return current_.token;
            }
        }

        if (refresher_ == nullptr || current_.refreshToken.empty())
        {
            throw std::runtime_error(lila::shared::errors::SessionExpiredMessage);
        }
        refreshToken = current_.refreshToken;
        refreshGeneration = requestedGeneration;
        refreshInProgress_ = true;
    }

    SessionRefreshResult result;
    try
    {
        result = refresher_->Refresh(refreshToken, stopToken);
    }
    catch (...)
    {
        lila::shared::security::SecureWipeString(refreshToken);
        {
            std::scoped_lock lock(mutex_);
            refreshInProgress_ = false;
            refreshCondition_.notify_all();
        }
        throw;
    }
    lila::shared::security::SecureWipeString(refreshToken);

    std::string supersededRefreshToken;
    std::string postRefreshError;
    {
        std::scoped_lock lock(mutex_);
        refreshInProgress_ = false;
        refreshCondition_.notify_all();

        if (refreshGeneration != generation_)
        {
            if (result.success)
            {
                supersededRefreshToken = std::move(result.refreshToken);
            }
        }
        else if (!result.success)
        {
            if (result.rejected)
            {
                repository_->Clear();
                current_ = {};
                persisted_ = false;
                ++generation_;
            }
            throw std::runtime_error(
                result.errorMessage.empty()
                    ? lila::shared::errors::SessionExpiredMessage
                    : result.errorMessage);
        }
        else
        {
            domain::Session updated = current_;
            updated.token = std::move(result.token);
            updated.refreshToken = std::move(result.refreshToken);
            updated.expiresAt = result.expiresAt;
            if (!updated.IsAuthenticated())
            {
                supersededRefreshToken = std::move(updated.refreshToken);
                postRefreshError = lila::shared::errors::SessionExpiredMessage;
            }
            else
            {
                if (persisted_)
                {
                    try
                    {
                        repository_->Save(updated);
                    }
                    catch (const std::exception& exception)
                    {
                        persisted_ = false;
                        try
                        {
                            repository_->Clear();
                        }
                        catch (...)
                        {
                        }
                        lila::shared::logging::LogWarning(
                            "SessionStore",
                            std::string("Refreshed session could not be persisted: ") + exception.what());
                    }
                }
                current_ = std::move(updated);
                lastSuccessfulRefreshGeneration_ = refreshGeneration;
                return current_.token;
            }
        }
    }

    if (!supersededRefreshToken.empty())
    {
        try
        {
            static_cast<void>(refresher_->Revoke(supersededRefreshToken));
        }
        catch (const std::exception& exception)
        {
            lila::shared::logging::LogWarning(
                "SessionStore",
                std::string("Superseded refresh token cleanup failed: ") + exception.what());
        }
        lila::shared::security::SecureWipeString(supersededRefreshToken);
    }
    throw std::runtime_error(
        postRefreshError.empty()
            ? lila::shared::errors::NoActiveSession
            : postRefreshError);
}
}

