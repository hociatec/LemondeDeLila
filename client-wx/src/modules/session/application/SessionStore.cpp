#include "modules/session/application/SessionStore.h"
#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/logging/application/Logger.h"

#include <stdexcept>
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
    persisted_ = !current_.resumeOnce;
    current_.resumeOnce = false;
    current_.resumeUntil = 0;
    ++generation_;
    return true;
}

bool SessionStore::PrepareUpdateRestart()
{
    std::scoped_lock lock(mutex_);
    if (!HasSessionLocked())
    {
        return true;
    }
    if (persisted_)
    {
        return true;
    }
    try
    {
        repository_->SaveForRestart(current_);
        persisted_ = false;
        return true;
    }
    catch (const std::exception& exception)
    {
        lila::shared::logging::LogWarning(
            "SessionStore",
            std::string("Update session handoff failed: ") + exception.what());
        return false;
    }
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
}
