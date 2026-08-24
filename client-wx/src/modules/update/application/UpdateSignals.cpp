#include "modules/update/application/UpdateSignals.h"

#ifdef _WIN32
#include <windows.h>

#include <string>
#endif

namespace lila::modules::update
{
#ifdef _WIN32
namespace
{
std::wstring SignalName(const wchar_t* kind)
{
    return std::wstring(L"Local\\LeMondeDeLilaWX.") + kind + L"." +
        std::to_wstring(::GetCurrentProcessId());
}
}
#endif

bool IsForcedUpdateRequested()
{
#ifdef _WIN32
    HANDLE signal = ::OpenEventW(SYNCHRONIZE, FALSE, SignalName(L"Update").c_str());
    if (signal == nullptr) return false;
    const bool requested = ::WaitForSingleObject(signal, 0) == WAIT_OBJECT_0;
    ::CloseHandle(signal);
    return requested;
#else
    return false;
#endif
}

bool IsLauncherActive()
{
#if defined(_WIN32) && defined(NDEBUG)
    HANDLE mutex = ::OpenMutexW(SYNCHRONIZE, FALSE,
        L"Local\\LeMondeDeLilaWX.Launcher");
    if (mutex == nullptr) return false;
    ::CloseHandle(mutex);
    return true;
#else
    return true;
#endif
}

void* CreateHealthySignal()
{
#ifdef _WIN32
    HANDLE signal = ::CreateEventW(nullptr, TRUE, TRUE, SignalName(L"Healthy").c_str());
    return signal;
#else
    return nullptr;
#endif
}

void CloseSignal(void* signal) noexcept
{
#ifdef _WIN32
    if (signal != nullptr) ::CloseHandle(static_cast<HANDLE>(signal));
#else
    (void)signal;
#endif
}
}
