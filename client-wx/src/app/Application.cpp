#include "app/Application.h"

#include "bootstrap/AppBootstrap.h"
#include "shared/config/AppConfig.h"
#include "shared/concurrency/BackgroundExecutor.h"
#include "shared/logging/Logger.h"
#include "shared/text/Encoding.h"

#include <wx/msgdlg.h>

#include <iomanip>
#include <sstream>
#include <string>

#ifdef _WIN32
#include <windows.h>
#endif

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

bool StartWithSehRaw(
    lila::bootstrap::AppBootstrap* bootstrap,
    SehDetails& details)
{
    __try
    {
        return bootstrap->Start();
    }
    __except (CaptureSehDetails(GetExceptionInformation(), &details))
    {
        return false;
    }
}

#endif

bool StartWithSeh(
    std::unique_ptr<lila::bootstrap::AppBootstrap>& bootstrap,
    std::string& failureMessage)
{
#ifdef _WIN32

    SehDetails seh;

    const bool result = StartWithSehRaw(
        bootstrap.get(),
        seh);

    if (!result && seh.code != 0)
    {
        const char* operation = "inconnue";
        if (seh.accessType == 0)
        {
            operation = "lecture";
        }
        else if (seh.accessType == 1)
        {
            operation = "écriture";
        }
        else if (seh.accessType == 8)
        {
            operation = "exécution";
        }

        std::ostringstream details;
        details << "Exception SEH 0x"
                << std::hex << std::uppercase << std::setfill('0') << std::setw(8) << seh.code
                << " à l'étape '" << bootstrap->CurrentStep() << "'"
                << ", instruction=" << seh.exceptionAddress;

        if (seh.code == EXCEPTION_ACCESS_VIOLATION && seh.accessType != static_cast<ULONG_PTR>(-1))
        {
            details << ", opération=" << operation
                    << ", adresse visée=" << reinterpret_cast<void*>(seh.accessedAddress);
        }

        details << ".";
        failureMessage = details.str();
    }

    return result;

#else

    (void)failureMessage;
    return bootstrap->Start();

#endif
}

}

namespace lila::app
{

Application::Application() = default;

Application::~Application() = default;

bool Application::OnInit()
{
    if (!wxApp::OnInit())
    {
        return false;
    }

    SetAppName("LeMondeDeLilaWX");
    SetVendorName("LeMondeDeLila");

    lila::shared::concurrency::BackgroundExecutorOptions executorOptions;
    executorOptions.workerCount = shared::config::AppConfig::ResolveBackgroundWorkerCount().value_or(0);
    backgroundExecutor_ = std::make_unique<lila::shared::concurrency::BackgroundExecutor>(executorOptions);
    lila::shared::concurrency::InstallBackgroundExecutor(*backgroundExecutor_);

    bootstrap_ = std::make_unique<lila::bootstrap::AppBootstrap>();

    std::string failureMessage;

    const bool started = StartWithSeh(
        bootstrap_,
        failureMessage);

    if (!started)
    {
        const std::string message =
            failureMessage.empty()
                ? "Le démarrage de l'application a échoué. Consultez client.log."
                : failureMessage;

        lila::shared::logging::LogError(
            "Startup",
            message);

        wxMessageBox(
            lila::shared::text::FromUtf8(message),
            wxString(L"Erreur de démarrage"),
            wxOK | wxICON_ERROR);

        return false;
    }

    return true;
}

int Application::OnExit()
{
    if (backgroundExecutor_ != nullptr)
    {
        backgroundExecutor_->Shutdown();
        lila::shared::concurrency::UninstallBackgroundExecutor();
        backgroundExecutor_.reset();
    }

    bootstrap_.reset();

    return wxApp::OnExit();
}

}
