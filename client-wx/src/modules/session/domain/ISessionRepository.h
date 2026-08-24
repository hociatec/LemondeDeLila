#pragma once

#include <optional>

#include "modules/session/domain/Session.h"

namespace lila::modules::session::domain
{
class ISessionRepository
{
public:
    virtual ~ISessionRepository() = default;

    [[nodiscard]] virtual std::optional<Session> Load() const = 0;
    virtual void Save(const Session& session) = 0;
    virtual void SaveForRestart(const Session& session) { Save(session); }
    virtual void Clear() = 0;
};
}
