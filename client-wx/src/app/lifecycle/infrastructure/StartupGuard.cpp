#include "app/lifecycle/infrastructure/StartupGuard.h"

#include <iomanip>
#include <sstream>

#include "bootstrap/lifecycle/application/AppBootstrap.h"

#ifdef _WIN32
#include <windows.h>
#endif

namespace lila::app::lifecycle
{
namespace
{
#ifdef _WIN32
struct SehDetails final
{
    DWORD code = 0;
    void* exceptionAddress = nullptr;
    ULONG_PTR accessType = static_cast<ULONG_PTR>(-1);
    ULONG_PTR accessedAddress = 0;
};

LONG CaptureSehDetails(EXCEPTION_POINTERS* information, SehDetails* details) noexcept
{
    if (information != nullptr && details != nullptr && information->ExceptionRecord != nullptr)
    {
        const EXCEPTION_RECORD& record = *information->ExceptionRecord;
        details->code = record.ExceptionCode;
        details->exceptionAddress = record.ExceptionAddress;
        if (record.ExceptionCode == EXCEPTION_ACCESS_VIOLATION && record.NumberParameters >= 2)
        {
            details->accessType = record.ExceptionInformation[0];
            details->accessedAddress = record.ExceptionInformation[1];
        }
    }
    return EXCEPTION_EXECUTE_HANDLER;
}

bool StartWithSeh(lila::bootstrap::AppBootstrap& bootstrap, SehDetails& details)
{
    __try
    {
        return bootstrap.Start();
    }
    __except (CaptureSehDetails(GetExceptionInformation(), &details))
    {
        return false;
    }
}

void DescribeSehFailure(
    const lila::bootstrap::AppBootstrap& bootstrap,
    const SehDetails& seh,
    std::string& failureMessage)
{
    const char* operation = "inconnue";
    if (seh.accessType == 0) operation = "lecture";
    else if (seh.accessType == 1) operation = "écriture";
    else if (seh.accessType == 8) operation = "exécution";

    std::ostringstream details;
    details << "Exception SEH 0x"
            << std::hex << std::uppercase << std::setfill('0') << std::setw(8) << seh.code
            << " à l'étape '" << bootstrap.CurrentStep() << "'"
            << ", instruction=" << seh.exceptionAddress;
    if (seh.code == EXCEPTION_ACCESS_VIOLATION && seh.accessType != static_cast<ULONG_PTR>(-1))
    {
        details << ", opération=" << operation
                << ", adresse visée=" << reinterpret_cast<void*>(seh.accessedAddress);
    }
    details << ".";
    failureMessage = details.str();
}
#endif
}

bool StartBootstrapSafely(
    lila::bootstrap::AppBootstrap& bootstrap,
    std::string& failureMessage)
{
#ifdef _WIN32
    SehDetails seh;
    const bool started = StartWithSeh(bootstrap, seh);
    if (!started && seh.code != 0)
    {
        DescribeSehFailure(bootstrap, seh, failureMessage);
    }
    return started;
#else
    static_cast<void>(failureMessage);
    return bootstrap.Start();
#endif
}
}
