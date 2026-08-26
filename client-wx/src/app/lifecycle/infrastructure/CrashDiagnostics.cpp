#include "app/lifecycle/infrastructure/CrashDiagnostics.h"

#ifdef _WIN32

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX 1
#include <windows.h>

#include <cstdio>
#include <cstdint>

namespace lila::app::lifecycle
{
namespace
{
LONG WINAPI RecordUnhandledException(EXCEPTION_POINTERS* information) noexcept
{
    static volatile LONG recording = 0;
    if (InterlockedExchange(&recording, 1) != 0)
    {
        return EXCEPTION_CONTINUE_SEARCH;
    }

    DWORD code = 0;
    void* exceptionAddress = nullptr;
    ULONG_PTR accessType = static_cast<ULONG_PTR>(-1);
    ULONG_PTR accessedAddress = 0;
    if (information != nullptr && information->ExceptionRecord != nullptr)
    {
        const EXCEPTION_RECORD& record = *information->ExceptionRecord;
        code = record.ExceptionCode;
        exceptionAddress = record.ExceptionAddress;
        if (record.ExceptionCode == EXCEPTION_ACCESS_VIOLATION && record.NumberParameters >= 2)
        {
            accessType = record.ExceptionInformation[0];
            accessedAddress = record.ExceptionInformation[1];
        }
    }

    MEMORY_BASIC_INFORMATION memory{};
    HMODULE module = nullptr;
    if (exceptionAddress != nullptr &&
        VirtualQuery(exceptionAddress, &memory, sizeof(memory)) == sizeof(memory))
    {
        module = static_cast<HMODULE>(memory.AllocationBase);
    }

    char modulePath[32768] = "unknown";
    if (module != nullptr)
    {
        const DWORD length = GetModuleFileNameA(
            module,
            modulePath,
            static_cast<DWORD>(sizeof(modulePath)));
        if (length == 0 || length >= sizeof(modulePath))
        {
            std::snprintf(modulePath, sizeof(modulePath), "unknown");
        }
    }

    const auto moduleBase = reinterpret_cast<std::uintptr_t>(module);
    const auto instruction = reinterpret_cast<std::uintptr_t>(exceptionAddress);
    const auto moduleOffset = moduleBase != 0 && instruction >= moduleBase
        ? instruction - moduleBase
        : 0;
    const char* operation = "unknown";
    if (accessType == 0) operation = "read";
    else if (accessType == 1) operation = "write";
    else if (accessType == 8) operation = "execute";

    SYSTEMTIME utc{};
    GetSystemTime(&utc);
    char line[33792]{};
    const int length = std::snprintf(
        line,
        sizeof(line),
        "%04u-%02u-%02uT%02u:%02u:%02u.%03uZ "
        "code=0x%08lX thread=%lu instruction=%p module=%s base=%p offset=0x%llX "
        "operation=%s target=%p\r\n",
        static_cast<unsigned>(utc.wYear),
        static_cast<unsigned>(utc.wMonth),
        static_cast<unsigned>(utc.wDay),
        static_cast<unsigned>(utc.wHour),
        static_cast<unsigned>(utc.wMinute),
        static_cast<unsigned>(utc.wSecond),
        static_cast<unsigned>(utc.wMilliseconds),
        static_cast<unsigned long>(code),
        static_cast<unsigned long>(GetCurrentThreadId()),
        exceptionAddress,
        modulePath,
        static_cast<void*>(module),
        static_cast<unsigned long long>(moduleOffset),
        operation,
        reinterpret_cast<void*>(accessedAddress));

    if (length > 0)
    {
        HANDLE file = CreateFileW(
            L"client-crash.log",
            FILE_APPEND_DATA,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            nullptr,
            OPEN_ALWAYS,
            FILE_ATTRIBUTE_NORMAL | FILE_FLAG_WRITE_THROUGH,
            nullptr);
        if (file != INVALID_HANDLE_VALUE)
        {
            const DWORD bytesToWrite = static_cast<DWORD>(
                length < static_cast<int>(sizeof(line)) ? length : sizeof(line) - 1);
            DWORD written = 0;
            WriteFile(file, line, bytesToWrite, &written, nullptr);
            FlushFileBuffers(file);
            CloseHandle(file);
        }
    }

    return EXCEPTION_CONTINUE_SEARCH;
}
}

void InstallCrashDiagnostics() noexcept
{
    SetUnhandledExceptionFilter(&RecordUnhandledException);
}
}

#else

namespace lila::app::lifecycle
{
void InstallCrashDiagnostics() noexcept
{
}
}

#endif
