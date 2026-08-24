#pragma once

#include <memory>
#include <atomic>
#include <cstdint>
#include <shared_mutex>

#include "modules/options/domain/OptionsState.h"
#include "modules/options/domain/IOptionsRepository.h"

namespace lila::modules::options::application
{
class OptionsStore final
{
public:
    explicit OptionsStore(std::unique_ptr<domain::IOptionsRepository> repository);

    void Load();
    [[nodiscard]] domain::OptionsState Current() const;
    [[nodiscard]] std::uint64_t Revision() const noexcept;
    void Apply(const domain::OptionsState& state);
    void Update(domain::OptionsState state);

private:
    std::unique_ptr<domain::IOptionsRepository> repository_;
    mutable std::shared_mutex mutex_;
    domain::OptionsState current_;
    std::atomic<std::uint64_t> revision_ = 0;
};
}
