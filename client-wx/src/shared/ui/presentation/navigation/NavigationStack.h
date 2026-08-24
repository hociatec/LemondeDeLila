#pragma once

#include <utility>
#include <vector>

namespace lila::shared::ui::navigation
{
template <typename Snapshot>
class NavigationStack final
{
public:
    void Push(Snapshot snapshot)
    {
        entries_.push_back(std::move(snapshot));
    }

    [[nodiscard]] bool Empty() const noexcept
    {
        return entries_.empty();
    }

    [[nodiscard]] Snapshot Pop()
    {
        Snapshot snapshot = std::move(entries_.back());
        entries_.pop_back();
        return snapshot;
    }

    void Clear() noexcept
    {
        entries_.clear();
    }

private:
    std::vector<Snapshot> entries_;
};
}
