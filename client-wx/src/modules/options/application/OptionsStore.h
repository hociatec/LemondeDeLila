#pragma once

#include <memory>

#include "modules/options/domain/OptionsState.h"
#include "modules/options/domain/IOptionsRepository.h"

namespace lila::modules::options::application
{
class OptionsStore final
{
public:
    explicit OptionsStore(std::unique_ptr<domain::IOptionsRepository> repository);

    void Load();
    [[nodiscard]] const domain::OptionsState& Current() const;
    void Apply(const domain::OptionsState& state);
    void Update(domain::OptionsState state);

private:
    std::unique_ptr<domain::IOptionsRepository> repository_;
    domain::OptionsState current_;
};
}
