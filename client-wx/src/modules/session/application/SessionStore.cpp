#include "modules/session/application/SessionStore.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/logging/application/Logger.h"
#include "shared/security/infrastructure/SecurityUtils.h"

#include <stdexcept>
#include <ctime>
#include <utility>

namespace lila::modules::session::application
{
SessionStore::SessionStore(
    std::unique_ptr<domain::ISessionRepository> repository,
    std::unique_ptr<ISessionRefresher> refresher)
    : repository_(std::move(repository)),
      refresher_(std::move(refresher))
{
}

void SessionStore::Open(domain::Session session, bool persist)
{
    std::scoped_lock lock(mutex_);
    if (persist)
    {
        repository_->Save(session);
    }
    else
    {
        repository_->Clear();
    }

    current_ = std::move(session);
    persisted_ = persist;
    ++generation_;
}

void SessionStore::Clear()
{
    std::scoped_lock lock(mutex_);
    repository_->Clear();
    current_ = {};
    persisted_ = false;
    ++generation_;
}

std::shared_ptr<lila::shared::concurrency::BackgroundTaskHandle>
SessionStore::LogoutAsync(std::function<void()> completion)
{
    return ScheduleRevocation(DetachSession(false), std::move(completion));
}

std::shared_ptr<lila::shared::concurrency::BackgroundTaskHandle>
SessionStore::RevokeTransientSessionAsync(std::function<void()> completion)
{
    return ScheduleRevocation(DetachSession(true), std::move(completion));
}

bool SessionStore::Restore()
{
    std::scoped_lock lock(mutex_);
    const auto stored = repository_->Load();
    if (!stored.has_value())
    {
        repository_->Clear();
        current_ = {};
        persisted_ = false;
        ++generation_;
        return false;
    }

    current_ = *stored;
    persisted_ = true;
    ++generation_;
    return true;
}

void SessionStore::SyncPersistence(bool persist)
{
    std::scoped_lock lock(mutex_);
    persisted_ = persist;

    if (!persist)
    {
        repository_->Clear();
        return;
    }

    if (HasSessionLocked())
    {
        repository_->Save(current_);
    }
}

bool SessionStore::HasActiveSession() const
{
    std::scoped_lock lock(mutex_);
    return HasSessionLocked();
}

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

domain::Session SessionStore::Current() const
{
    std::scoped_lock lock(mutex_);
    if (!HasSessionLocked())
    {
        throw std::runtime_error(lila::shared::errors::NoActiveSession);
    }

    return current_;
}

bool SessionStore::IsPersistent() const
{
    std::scoped_lock lock(mutex_);
    return persisted_;
}

bool SessionStore::HasSessionLocked() const
{
    const bool hasIdentity = current_.userId.IsValid() && !current_.username.empty();
    return hasIdentity && (current_.IsAuthenticated() || !current_.refreshToken.empty());
}

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
