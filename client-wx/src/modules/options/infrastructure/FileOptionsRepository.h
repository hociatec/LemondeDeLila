#pragma once

#include "modules/options/domain/IOptionsRepository.h"

namespace lila::modules::options::infrastructure
{
class FileOptionsRepository final : public domain::IOptionsRepository
{
public:
    [[nodiscard]] domain::OptionsState Load() const override;
    void Save(const domain::OptionsState& state) const override;
};
}
