#pragma once

#ifdef _WIN32
#include <atomic>

#include <windows.h>
#include <winhttp.h>

namespace lila::shared::network::winhttp
{
class Handle final
{
public:
    Handle() = default;
    explicit Handle(HINTERNET handle) noexcept : handle_(handle) {}
    ~Handle() { Reset(); }

    Handle(const Handle&) = delete;
    Handle& operator=(const Handle&) = delete;

    Handle(Handle&& other) noexcept : handle_(other.Release()) {}
    Handle& operator=(Handle&& other) noexcept
    {
        if (this != &other)
        {
            Reset(other.Release());
        }
        return *this;
    }

    [[nodiscard]] HINTERNET Get() const noexcept { return handle_.load(std::memory_order_acquire); }
    [[nodiscard]] explicit operator bool() const noexcept { return Get() != nullptr; }

    [[nodiscard]] HINTERNET Release() noexcept
    {
        return handle_.exchange(nullptr, std::memory_order_acq_rel);
    }

    void Reset(HINTERNET handle = nullptr) noexcept
    {
        auto* previous = handle_.exchange(handle, std::memory_order_acq_rel);
        if (previous != nullptr)
        {
            WinHttpCloseHandle(previous);
        }
    }

private:
    std::atomic<HINTERNET> handle_{nullptr};
};
}
#endif
