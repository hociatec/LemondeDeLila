#pragma once

#include <cstddef>
#include <memory>
#include <utility>

#include "shared/concurrency/application/BackgroundExecutor.h"

namespace lila::shared::concurrency
{
class AsyncRequestSlot final
{
public:
    using Token = std::size_t;

    ~AsyncRequestSlot() { Cancel(); }

    AsyncRequestSlot() = default;
    AsyncRequestSlot(const AsyncRequestSlot&) = delete;
    AsyncRequestSlot& operator=(const AsyncRequestSlot&) = delete;

    void Cancel()
    {
        ++token_;
        if (task_) task_->RequestCancel();
        task_.reset();
    }

    [[nodiscard]] Token CurrentToken() const noexcept { return token_; }

    void Track(std::shared_ptr<BackgroundTaskHandle> task)
    {
        task_ = std::move(task);
    }

    [[nodiscard]] bool Complete(Token token)
    {
        if (token != token_) return false;
        task_.reset();
        return true;
    }

private:
    std::shared_ptr<BackgroundTaskHandle> task_;
    Token token_ = 0;
};
}
