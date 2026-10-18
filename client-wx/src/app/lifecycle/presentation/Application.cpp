#include "app/lifecycle/presentation/Application.h"

#include <string>
#include <future>

#include <wx/msgdlg.h>
#include <wx/window.h>
#include <wx/weakref.h>

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
bool WaitForServer(lila::bootstrap::AppBootstrap& bootstrap)
{
    for (;;)
    {
        std::string failure;
        auto attempt = std::async(std::launch::async, [&bootstrap]
            {
                bootstrap.CheckServerConnection();
            });
            try
            {
                attempt.get();
            }
            catch (const std::exception& error)
            {
                failure = error.what();
                if (failure.empty()) failure = "Connection failed.";
            }
        if (failure.empty()) return true;
        lila::shared::logging::LogWarning("Startup", "Serveur inaccessible : " + failure);
        wxMessageDialog dialog(
            nullptr,
            wxString(L"Connexion impossible : le serveur du Monde de Lila est injoignable.\n\n"
                     L"Vérifiez votre connexion Internet. Si vous êtes connecté, le serveur peut être "
                     L"temporairement indisponible.\n\n"
                     L"L'application a besoin du serveur pour fonctionner. Vous pouvez réessayer ou quitter."),
            wxString(L"Connexion impossible"), wxYES_NO | wxICON_ERROR);
        dialog.SetYesNoLabels(wxString(L"Réessayer"), wxString(L"Quitter"));
        if (dialog.ShowModal() != wxID_YES) return false;
    }
}

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

wxWindow* RevealMainWindow(wxApp& application)
{
    auto* window = application.GetTopWindow();
    if (window == nullptr)
    {
        lila::shared::logging::LogError("Startup", "Fenêtre principale absente après le bootstrap.");
        return nullptr;
    }

    ActivateMainWindow(*window);
    return window;
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
    // The runtime has started successfully. A network outage must not trigger
    // the launcher's 30-second startup timeout or a release rollback.
    healthySignal_ = lila::modules::update::CreateHealthySignal();
    const wxWeakRef<wxWindow> startupWindow(GetTopWindow());
    CallAfter([startupWindow, this]
    {
        if (!startupWindow || !WaitForServer(*bootstrap_) || !startupWindow)
        {
            bootstrap_->Stop();
            return;
        }
        auto* mainWindow = GetTopWindow();
#ifdef __WXMSW__
        if (bootstrap_ != nullptr) bootstrap_->PrepareInitialViewAnnouncement();
        if (mainWindow != nullptr)
            for (auto* child : mainWindow->GetChildren()) child->Disable();
#endif
        mainWindow = RevealMainWindow(*this);
        if (mainWindow != nullptr)
        {
#ifdef __WXMSW__
            for (auto* child : mainWindow->GetChildren()) child->Enable();
            if (bootstrap_ != nullptr) bootstrap_->FocusInitialView();
            lila::shared::logging::LogInfo(
                "Startup", "Focus du menu initial demandé sans attendre la parole NVDA.");
#else
            if (bootstrap_ != nullptr) bootstrap_->FocusCurrentView();
#endif
        }
    });
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
