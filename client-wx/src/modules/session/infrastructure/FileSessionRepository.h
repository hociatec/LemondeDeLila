#pragma once

#include "modules/session/domain/ISessionRepository.h"

namespace lila::modules::session::infrastructure
{
class FileSessionRepository final : public domain::ISessionRepository
{
public:
    [[nodiscard]] std::optional<domain::Session> Load() const override;
    void Save(const domain::Session& session) override;
    void Clear() override;
};
}
