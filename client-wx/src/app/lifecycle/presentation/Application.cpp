#include "app/lifecycle/presentation/Application.h"

#include <functional>
#include <string>
#include <utility>

#include <wx/msgdlg.h>
#include <wx/weakref.h>
#include <wx/window.h>

#ifdef __WXMSW__
#include <windows.h>
#endif

#include "app/lifecycle/infrastructure/CrashDiagnostics.h"
#include "app/lifecycle/infrastructure/StartupGuard.h"
#include "bootstrap/lifecycle/application/AppBootstrap.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/config/domain/AppConfig.h"
#include "shared/logging/application/Logger.h"
#include "shared/text/presentation/encoding/Encoding.h"
#include "modules/update/application/UpdateSignals.h"

namespace lila::app
{
namespace
{
void ActivateMainWindow(wxWindow& window)
{
    window.Show(true);
#ifdef __WXMSW__
    const HWND nativeWindow = reinterpret_cast<HWND>(window.GetHandle());
    if (nativeWindow != nullptr)
    {
        if (IsIconic(nativeWindow))
        {
            ShowWindow(nativeWindow, SW_RESTORE);
        }
        else
        {
            ShowWindow(nativeWindow, SW_SHOW);
        }
        window.Raise();
        BringWindowToTop(nativeWindow);
        SetActiveWindow(nativeWindow);
        if (!SetForegroundWindow(nativeWindow))
        {
            lila::shared::logging::LogWarning(
                "Startup", "Windows n'a pas accordé immédiatement le premier plan au client.");
        }
        return;
    }
#endif
    window.Raise();
}

void RevealMainWindowAfterEventLoop(wxApp& application, std::function<void()> restoreViewFocus)
{
    auto* window = application.GetTopWindow();
    if (window == nullptr)
    {
        lila::shared::logging::LogError("Startup", "Fenêtre principale absente après le bootstrap.");
        return;
    }

    ActivateMainWindow(*window);
    wxWeakRef<wxWindow> weakWindow(window);
    application.CallAfter(
        [weakWindow, restoreViewFocus = std::move(restoreViewFocus)]()
        {
            auto* resolved = weakWindow.get();
            if (resolved == nullptr)
            {
                return;
            }
            ActivateMainWindow(*resolved);
            if (restoreViewFocus)
            {
                restoreViewFocus();
            }
            lila::shared::logging::LogInfo(
                "Startup",
                "Fenêtre principale activée et focus de la vue restauré.");
        });
}
}

Application::Application() = default;

Application::~Application() = default;

bool Application::OnInit()
{
    lifecycle::InstallCrashDiagnostics();
    if (!wxApp::OnInit())
    {
        return false;
    }
    // Some GUI/runtime components can install their own top-level filter.
    // Reassert ours before constructing services and the main window.
    lifecycle::InstallCrashDiagnostics();

    SetAppName("LeMondeDeLilaWX");
    SetVendorName("LeMondeDeLila");

    if (!lila::modules::update::IsLauncherActive())
    {
        wxMessageBox(
            wxString(L"Cette version doit être démarrée avec Le Monde de Lila (lila_launcher.exe)."),
            wxString(L"Lanceur requis"),
            wxOK | wxICON_ERROR);
        return false;
    }

    lila::shared::concurrency::BackgroundExecutorOptions executorOptions;
    executorOptions.workerCount = shared::config::AppConfig::ResolveBackgroundWorkerCount().value_or(0);
    backgroundExecutor_ = std::make_unique<lila::shared::concurrency::BackgroundExecutor>(executorOptions);
    lila::shared::concurrency::InstallBackgroundExecutor(*backgroundExecutor_);

    bootstrap_ = std::make_unique<lila::bootstrap::AppBootstrap>();
    std::string failureMessage;
    if (!lifecycle::StartBootstrapSafely(*bootstrap_, failureMessage))
    {
        const std::string message = failureMessage.empty()
            ? "Le démarrage de l'application a échoué. Consultez client.log."
            : failureMessage;
        lila::shared::logging::LogError("Startup", message);
        wxMessageBox(
            lila::shared::text::FromUtf8(message),
            wxString(L"Erreur de démarrage"),
            wxOK | wxICON_ERROR);
        return false;
    }
    RevealMainWindowAfterEventLoop(
        *this,
        [this]()
        {
            if (bootstrap_ != nullptr)
            {
                bootstrap_->FocusCurrentView();
            }
        });
    healthySignal_ = lila::modules::update::CreateHealthySignal();
    return true;
}

int Application::OnExit()
{
    lila::modules::update::CloseSignal(healthySignal_);
    healthySignal_ = nullptr;
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
