#pragma once

#include <algorithm>
#include <cstddef>
#include <deque>
#include <mutex>
#include <utility>
#include <vector>

#include "modules/gameplay/session/domain/GameEvent.h"

namespace lila::modules::gameplay::application
{
class GameEventMailbox final
{
public:
    struct Batch final
    {
        std::vector<domain::GameEvent> events;
        bool morePending = false;
    };

    explicit GameEventMailbox(std::size_t capacity = 256)
        : capacity_(std::max<std::size_t>(1, capacity))
    {
    }

    [[nodiscard]] bool Enqueue(domain::GameEvent event)
    {
        std::scoped_lock lock(mutex_);
        if (IsCoalescible(event.type))
        {
            const auto originalSize = events_.size();
            std::erase_if(events_, [&event](const auto& queued) {
                return queued.type == event.type;
            });
            dropped_ += originalSize - events_.size();
        }
        if (events_.size() >= capacity_)
        {
            const auto discard = std::find_if(events_.begin(), events_.end(), [](const auto& queued) {
                return IsCoalescible(queued.type);
            });
            if (discard != events_.end()) events_.erase(discard);
            else events_.pop_front();
            ++dropped_;
        }
        events_.push_back(std::move(event));
        if (drainScheduled_) return false;
        drainScheduled_ = true;
        return true;
    }

    [[nodiscard]] Batch Drain(std::size_t maximum = 32)
    {
        std::scoped_lock lock(mutex_);
        Batch batch;
        const auto count = std::min(std::max<std::size_t>(1, maximum), events_.size());
        batch.events.reserve(count);
        for (std::size_t index = 0; index < count; ++index)
        {
            batch.events.push_back(std::move(events_.front()));
            events_.pop_front();
        }
        batch.morePending = !events_.empty();
        if (!batch.morePending) drainScheduled_ = false;
        return batch;
    }

    void Clear()
    {
        std::scoped_lock lock(mutex_);
        events_.clear();
        drainScheduled_ = false;
    }

    [[nodiscard]] std::size_t Pending() const
    {
        std::scoped_lock lock(mutex_);
        return events_.size();
    }
    [[nodiscard]] std::size_t Dropped() const
    {
        std::scoped_lock lock(mutex_);
        return dropped_;
    }

private:
    [[nodiscard]] static bool IsCoalescible(domain::GameEventType type) noexcept
    {
        return type == domain::GameEventType::StateUpdated ||
            type == domain::GameEventType::TurnUpdated ||
            type == domain::GameEventType::ActionCandidates ||
            type == domain::GameEventType::Rules ||
            type == domain::GameEventType::ConnectionStatus;
    }

    const std::size_t capacity_;
    mutable std::mutex mutex_;
    std::deque<domain::GameEvent> events_;
    std::size_t dropped_ = 0;
    bool drainScheduled_ = false;
};
}
