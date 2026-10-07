#pragma once

#include <memory>

#include <wx/app.h>
#include <wx/timer.h>

namespace lila::bootstrap
{
class AppBootstrap;
}

namespace lila::shared::concurrency
{
class BackgroundExecutor;
}

namespace lila::app
{
class Application final : public wxApp
{
public:
    Application();
    ~Application() override;

    bool OnInit() override;
    int OnExit() override;

private:
    std::unique_ptr<lila::shared::concurrency::BackgroundExecutor> backgroundExecutor_;
    std::unique_ptr<lila::bootstrap::AppBootstrap> bootstrap_;
    std::unique_ptr<wxTimer> startupFocusTimer_;
    void* healthySignal_ = nullptr;
};
}
