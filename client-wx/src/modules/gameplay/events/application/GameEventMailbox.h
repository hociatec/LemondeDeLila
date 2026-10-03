#pragma once
#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
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
    using SessionToken = std::uint64_t;

    struct EnqueueResult final
    {
        bool accepted = false;
        bool shouldSchedule = false;
        bool saturated = false;
        SessionToken session = 0;
    };

    struct Batch final
    {
        std::vector<domain::GameEvent> events;
        bool morePending = false;
        bool resyncRequired = false;
    };

    explicit GameEventMailbox(std::size_t capacity = 256)
        : capacity_(std::max<std::size_t>(1, capacity)),
          criticalCapacity_(std::max<std::size_t>(8, capacity_ / 4))
    {
    }

    [[nodiscard]] SessionToken BeginSession()
    {
        std::scoped_lock lock(mutex_);
        ResetQueueLocked();
        return ++session_;
    }

    [[nodiscard]] EnqueueResult Enqueue(
        domain::GameEvent event, SessionToken session)
    {
        std::scoped_lock lock(mutex_);
        if (session != session_) return {false, false, false, session_};

        const auto type = event.type;
        bool saturated = false;
        if (IsCritical(type))
        {
            const auto duplicate = std::find_if(
                critical_.begin(), critical_.end(), [&event](const auto& queued) {
                    if (queued.type != event.type) return false;
                    if (queued.acknowledgement && event.acknowledgement)
                        return queued.acknowledgement->commandId ==
                            event.acknowledgement->commandId &&
                            queued.acknowledgement->command ==
                            event.acknowledgement->command;
                    return event.type == domain::GameEventType::Error &&
                        queued.errorCode == event.errorCode &&
                        queued.message == event.message;
                });
            if (duplicate != critical_.end())
            {
                *duplicate = std::move(event);
            }
            else
            {
                if (critical_.size() >= criticalCapacity_)
                {
                    saturated = !saturationReported_;
                    saturationReported_ = true;
                    RecordDroppedLocked(critical_.front().type, 1);
                    critical_.pop_front();
                    resyncRequired_ = true;
                }
                critical_.push_back(std::move(event));
            }
        }
        else
        {
            if (IsCoalescible(type))
            {
                const auto originalSize = regular_.size();
                std::erase_if(regular_, [type](const auto& queued) {
                    return queued.type == type;
                });
                RecordDroppedLocked(type, originalSize - regular_.size());
            }
            if (regular_.size() >= capacity_)
            {
                saturated = !saturationReported_;
                saturationReported_ = true;
                const auto discard = std::find_if(
                    regular_.begin(), regular_.end(), [](const auto& queued) {
                        return IsCoalescible(queued.type);
                    });
                if (discard != regular_.end())
                {
                    const auto discardedType = discard->type;
                    regular_.erase(discard);
                    RecordDroppedLocked(discardedType, 1);
                }
                else
                {
                    RecordDroppedLocked(regular_.front().type, 1);
                    regular_.pop_front();
                }
            }
            regular_.push_back(std::move(event));
        }
        const bool shouldSchedule = !drainScheduled_;
        drainScheduled_ = true;
        return {true, shouldSchedule, saturated, session_};
    }

    [[nodiscard]] Batch Drain(SessionToken session, std::size_t maximum = 32)
    {
        std::scoped_lock lock(mutex_);
        Batch batch;
        if (session != session_) return batch;
        const auto limit = std::max<std::size_t>(1, maximum);
        batch.events.reserve(std::min(limit, critical_.size() + regular_.size()));
        const auto criticalBudget = regular_.empty()
            ? limit : std::max<std::size_t>(1, (limit * 3) / 4);
        while (batch.events.size() < criticalBudget && !critical_.empty())
        {
            batch.events.push_back(std::move(critical_.front()));
            critical_.pop_front();
        }
        if (batch.events.size() < limit && !regular_.empty())
        {
            batch.events.push_back(std::move(regular_.front()));
            regular_.pop_front();
        }
        while (batch.events.size() < limit && !critical_.empty())
        {
            batch.events.push_back(std::move(critical_.front()));
            critical_.pop_front();
        }
        while (batch.events.size() < limit && !regular_.empty())
        {
            batch.events.push_back(std::move(regular_.front()));
            regular_.pop_front();
        }
        batch.morePending = !critical_.empty() || !regular_.empty();
        batch.resyncRequired = std::exchange(resyncRequired_, false);
        if (!batch.morePending) drainScheduled_ = false;
        return batch;
    }

    void Clear()
    {
        std::scoped_lock lock(mutex_);
        ResetQueueLocked();
        ++session_;
    }

    [[nodiscard]] SessionToken CurrentSession() const
    {
        std::scoped_lock lock(mutex_);
        return session_;
    }

    [[nodiscard]] std::size_t Pending() const
    {
        std::scoped_lock lock(mutex_);
        return critical_.size() + regular_.size();
    }

    [[nodiscard]] std::size_t Dropped() const
    {
        std::scoped_lock lock(mutex_);
        std::size_t total = 0;
        for (const auto count : droppedByType_) total += count;
        return total;
    }

    [[nodiscard]] std::size_t Dropped(domain::GameEventType type) const
    {
        std::scoped_lock lock(mutex_);
        return droppedByType_[Index(type)];
    }

private:
    static constexpr std::size_t TypeCount =
        static_cast<std::size_t>(domain::GameEventType::Ignored) + 1;

    [[nodiscard]] static constexpr std::size_t Index(
        domain::GameEventType type) noexcept
    {
        return static_cast<std::size_t>(type);
    }

    [[nodiscard]] static bool IsCritical(domain::GameEventType type) noexcept
    {
        return type == domain::GameEventType::Acknowledged ||
            type == domain::GameEventType::Error;
    }

    [[nodiscard]] static bool IsCoalescible(domain::GameEventType type) noexcept
    {
        return type == domain::GameEventType::StateUpdated ||
            type == domain::GameEventType::TurnUpdated ||
            type == domain::GameEventType::ActionCandidates ||
            type == domain::GameEventType::Rules ||
            type == domain::GameEventType::ConnectionStatus;
    }

    [[nodiscard]] static bool RequiresResync(domain::GameEventType type) noexcept
    {
        return type == domain::GameEventType::StateUpdated ||
            type == domain::GameEventType::TurnUpdated ||
            type == domain::GameEventType::ConnectionStatus;
    }

    void RecordDroppedLocked(domain::GameEventType type, std::size_t count)
    {
        if (count == 0) return;
        droppedByType_[Index(type)] += count;
        if (RequiresResync(type)) resyncRequired_ = true;
    }

    void ResetQueueLocked()
    {
        critical_.clear();
        regular_.clear();
        drainScheduled_ = false;
        resyncRequired_ = false;
        saturationReported_ = false;
    }

    const std::size_t capacity_;
    const std::size_t criticalCapacity_;
    mutable std::mutex mutex_;
    std::deque<domain::GameEvent> critical_;
    std::deque<domain::GameEvent> regular_;
    std::array<std::size_t, TypeCount> droppedByType_{};
    SessionToken session_ = 0;
    bool drainScheduled_ = false;
    bool resyncRequired_ = false;
    bool saturationReported_ = false;
};
}
