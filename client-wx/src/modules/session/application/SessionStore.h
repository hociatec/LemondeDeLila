#pragma once

#include <memory>

#include "modules/session/domain/ISessionRepository.h"
#include "modules/session/domain/Session.h"

namespace lila::modules::session::application
{
class SessionStore final
{
public:
    explicit SessionStore(std::unique_ptr<domain::ISessionRepository> repository);

    void Open(domain::Session session, bool persist);
    void Clear();
    [[nodiscard]] bool Restore();
    void SyncPersistence(bool persist);

    [[nodiscard]] bool HasActiveSession() const;
    [[nodiscard]] const domain::Session& Current() const;
    [[nodiscard]] bool IsPersistent() const;

private:
    std::unique_ptr<domain::ISessionRepository> repository_;
    domain::Session current_;
    bool persisted_ = false;
};
}
