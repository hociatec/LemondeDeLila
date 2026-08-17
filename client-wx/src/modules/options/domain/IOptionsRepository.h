#pragma once

#include "modules/options/domain/OptionsState.h"

namespace lila::modules::options::domain
{
class IOptionsRepository
{
public:
    virtual ~IOptionsRepository() = default;
    [[nodiscard]] virtual OptionsState Load() const = 0;
    virtual void Save(const OptionsState& state) const = 0;
};
}
