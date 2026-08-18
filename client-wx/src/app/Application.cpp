#include "app/Application.h"

#include "bootstrap/AppBootstrap.h"
#include "shared/concurrency/BackgroundExecutor.h"

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

    bootstrap_ = std::make_unique<lila::bootstrap::AppBootstrap>();
    return bootstrap_->Start();
}

int Application::OnExit()
{
    lila::shared::concurrency::ShutdownBackgroundExecutor();
    bootstrap_.reset();
    return wxApp::OnExit();
}
}
