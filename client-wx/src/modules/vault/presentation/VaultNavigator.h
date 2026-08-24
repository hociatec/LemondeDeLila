#pragma once

#include <cstddef>
#include <vector>

#include "modules/vault/domain/VaultSnapshot.h"

namespace lila::modules::vault::presentation
{
class VaultNavigator final
{
public:
    enum class Activation { None, Restore };

    void Reset(std::vector<domain::VaultSnapshot> snapshots);
    void Select(std::size_t index);
    [[nodiscard]] Activation Activate(std::size_t index);
    void RemoveSelected();

    [[nodiscard]] std::size_t SelectedIndex() const noexcept;
    [[nodiscard]] const std::vector<domain::VaultSnapshot>& Snapshots() const noexcept;
    [[nodiscard]] const domain::VaultSnapshot* SelectedSnapshot() const noexcept;

private:
    std::vector<domain::VaultSnapshot> snapshots_;
    std::size_t selectedSnapshot_ = 0;
};
}
