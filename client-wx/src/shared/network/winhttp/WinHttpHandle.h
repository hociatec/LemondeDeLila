#pragma once

#ifdef _WIN32
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

    [[nodiscard]] HINTERNET Get() const noexcept { return handle_; }
    [[nodiscard]] explicit operator bool() const noexcept { return handle_ != nullptr; }

    [[nodiscard]] HINTERNET Release() noexcept
    {
        auto* released = handle_;
        handle_ = nullptr;
        return released;
    }

    void Reset(HINTERNET handle = nullptr) noexcept
    {
        if (handle_ != nullptr)
        {
            WinHttpCloseHandle(handle_);
        }
        handle_ = handle;
    }

private:
    HINTERNET handle_ = nullptr;
};
}
#endif
