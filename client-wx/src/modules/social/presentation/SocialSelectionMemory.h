#pragma once
#include <array>
#include <cstddef>
#include <optional>
#include "modules/social/presentation/SocialSection.h"

namespace lila::modules::social::presentation
{
class SocialSelectionMemory final
{
public:
    void Store(SocialSection section, std::optional<std::size_t> selection);
    [[nodiscard]] std::optional<std::size_t> Get(SocialSection section) const;
    [[nodiscard]] std::optional<std::size_t> Restore(SocialSection section, std::size_t itemCount) const;
private:
    std::array<std::optional<std::size_t>, 5> selections_{};
};
}
