#include "app/lifecycle/presentation/Application.h"

#include <string>

#include <wx/msgdlg.h>

#include "app/lifecycle/infrastructure/StartupGuard.h"
#include "bootstrap/lifecycle/application/AppBootstrap.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/config/domain/AppConfig.h"
#include "shared/logging/application/Logger.h"
#include "shared/text/presentation/encoding/Encoding.h"
#include "modules/update/application/UpdateSignals.h"

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
