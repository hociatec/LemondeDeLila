#include "modules/vault/presentation/VaultNavigator.h"

#include <algorithm>

namespace lila::modules::vault::presentation
{
void VaultNavigator::Reset(std::vector<domain::VaultSnapshot> snapshots)
{
    snapshots_ = std::move(snapshots);
    selectedSnapshot_ = std::min(
        selectedSnapshot_, snapshots_.empty() ? std::size_t{0} : snapshots_.size() - 1);
}

void VaultNavigator::Select(std::size_t index)
{
    if (index < snapshots_.size()) selectedSnapshot_ = index;
}

VaultNavigator::Activation VaultNavigator::Activate(std::size_t index)
{
    Select(index);
    return index < snapshots_.size() ? Activation::Restore : Activation::None;
}

void VaultNavigator::RemoveSelected()
{
    if (selectedSnapshot_ < snapshots_.size())
        snapshots_.erase(snapshots_.begin() + static_cast<std::ptrdiff_t>(selectedSnapshot_));
    selectedSnapshot_ = std::min(
        selectedSnapshot_, snapshots_.empty() ? std::size_t{0} : snapshots_.size() - 1);
}

std::size_t VaultNavigator::SelectedIndex() const noexcept
{
    return selectedSnapshot_;
}

const std::vector<domain::VaultSnapshot>& VaultNavigator::Snapshots() const noexcept
{
    return snapshots_;
}

const domain::VaultSnapshot* VaultNavigator::SelectedSnapshot() const noexcept
{
    return selectedSnapshot_ < snapshots_.size() ? &snapshots_[selectedSnapshot_] : nullptr;
}
}
