#pragma once

#include <chrono>
#include <condition_variable>
#include <cstddef>
#include <cstdint>
#include <mutex>

namespace lila::shared::network::websocket
{
enum class WebSocketOperationPhase { Handshake, Send, Receive };

class WebSocketOperationGate final
{
public:
    struct Ticket final
    {
        std::uint64_t generation = 0;
        WebSocketOperationPhase phase = WebSocketOperationPhase::Receive;
        bool active = false;
    };

    [[nodiscard]] Ticket Begin(WebSocketOperationPhase phase)
    {
        std::scoped_lock lock(mutex_);
        ++Count(phase);
        return {generation_, phase, true};
    }

    void End(Ticket& ticket) noexcept
    {
        if (!ticket.active) return;
        {
            std::scoped_lock lock(mutex_);
            auto& count = Count(ticket.phase);
            if (count > 0) --count;
            ticket.active = false;
        }
        changed_.notify_all();
    }

    [[nodiscard]] std::uint64_t Cancel() noexcept
    {
        std::scoped_lock lock(mutex_);
        const auto cancelled = generation_++;
        changed_.notify_all();
        return cancelled;
    }

    [[nodiscard]] bool CancelIfCurrent(std::uint64_t generation) noexcept
    {
        std::scoped_lock lock(mutex_);
        if (generation_ != generation) return false;
        ++generation_;
        changed_.notify_all();
        return true;
    }

    [[nodiscard]] std::uint64_t Generation() const noexcept
    {
        std::scoped_lock lock(mutex_);
        return generation_;
    }

    template<class Rep, class Period>
    [[nodiscard]] bool WaitForIdle(
        std::chrono::duration<Rep, Period> timeout,
        bool includeReceives = true) const
    {
        std::unique_lock lock(mutex_);
        return changed_.wait_for(lock, timeout, [this, includeReceives]
        {
            return handshakes_ == 0 && sends_ == 0 &&
                (!includeReceives || receives_ == 0);
        });
    }

private:
    [[nodiscard]] std::size_t& Count(WebSocketOperationPhase phase) noexcept
    {
        if (phase == WebSocketOperationPhase::Handshake) return handshakes_;
        if (phase == WebSocketOperationPhase::Send) return sends_;
        return receives_;
    }

    mutable std::mutex mutex_;
    mutable std::condition_variable changed_;
    std::uint64_t generation_ = 0;
    std::size_t handshakes_ = 0;
    std::size_t sends_ = 0;
    std::size_t receives_ = 0;
};
}
