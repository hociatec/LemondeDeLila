#include "modules/session/application/SessionStore.h"
#include "shared/errors/ErrorMessages.h"

#include <stdexcept>
#include <utility>

namespace lila::modules::session::application
{
SessionStore::SessionStore(std::unique_ptr<domain::ISessionRepository> repository)
    : repository_(std::move(repository))
{
}

void SessionStore::Open(domain::Session session, bool persist)
{
    current_ = std::move(session);
    persisted_ = persist;
    if (persist)
    {
        repository_->Save(current_);
    }
    else
    {
        repository_->Clear();
    }
}

void SessionStore::Clear()
{
    repository_->Clear();
    current_ = {};
    persisted_ = false;
}

bool SessionStore::Restore()
{
    const auto stored = repository_->Load();
    if (!stored.has_value())
    {
        repository_->Clear();
        current_ = {};
        persisted_ = false;
        return false;
    }

    current_ = *stored;
    persisted_ = true;
    return true;
}

void SessionStore::SyncPersistence(bool persist)
{
    persisted_ = persist;

    if (!persist)
    {
        repository_->Clear();
        return;
    }

    if (HasActiveSession())
    {
        repository_->Save(current_);
    }
}

bool SessionStore::HasActiveSession() const
{
    return current_.IsAuthenticated();
}

const domain::Session& SessionStore::Current() const
{
    if (!HasActiveSession())
    {
        throw std::runtime_error(lila::shared::errors::NoActiveSession);
    }

    return current_;
}

bool SessionStore::IsPersistent() const
{
    return persisted_;
}
}
