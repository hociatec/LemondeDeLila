#pragma once

#include <condition_variable>
#include <cstddef>
#include <mutex>
#include <optional>
#include <stop_token>
#include <utility>

namespace lila::shared::cache
{
template <typename TValue>
class SingleFlightCache final
{
public:
    [[nodiscard]] std::optional<TValue> TryGet() const
    {
        std::scoped_lock lock(mutex_);
        return value_;
    }

    template <typename Loader>
    [[nodiscard]] std::optional<TValue> GetOrLoad(std::stop_token stopToken, Loader&& loader)
    {
        std::size_t loadGeneration = 0;
        {
            std::unique_lock lock(mutex_);
            if (value_.has_value())
            {
                return value_;
            }

            if (loading_)
            {
                const bool completed = completion_.wait(
                    lock,
                    stopToken,
                    [this]() { return value_.has_value() || !loading_; });
                if (!completed || stopToken.stop_requested())
                {
                    return std::nullopt;
                }
                if (value_.has_value())
                {
                    return value_;
                }
            }

            if (stopToken.stop_requested())
            {
                return std::nullopt;
            }

            loading_ = true;
            loadingGeneration_ = generation_;
            loadGeneration = generation_;
        }

        try
        {
            TValue loaded = std::forward<Loader>(loader)(stopToken);
            std::optional<TValue> result;
            {
                std::scoped_lock lock(mutex_);
                if (loading_ && loadingGeneration_ == loadGeneration)
                {
                    loading_ = false;
                }
                if (!stopToken.stop_requested() && generation_ == loadGeneration)
                {
                    value_ = std::move(loaded);
                    result = value_;
                }
            }
            completion_.notify_all();
            return result;
        }
        catch (...)
        {
            {
                std::scoped_lock lock(mutex_);
                if (loading_ && loadingGeneration_ == loadGeneration)
                {
                    loading_ = false;
                }
            }
            completion_.notify_all();
            throw;
        }
    }

    void Store(TValue value)
    {
        {
            std::scoped_lock lock(mutex_);
            ++generation_;
            value_ = std::move(value);
            loading_ = false;
        }
        completion_.notify_all();
    }

    void Clear()
    {
        {
            std::scoped_lock lock(mutex_);
            ++generation_;
            value_.reset();
            loading_ = false;
        }
        completion_.notify_all();
    }

private:
    mutable std::mutex mutex_;
    std::condition_variable_any completion_;
    std::optional<TValue> value_;
    std::size_t generation_ = 0;
    std::size_t loadingGeneration_ = 0;
    bool loading_ = false;
};
}
