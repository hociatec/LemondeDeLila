#pragma once

#include <memory>

namespace lila::bootstrap
{
class AppRuntime;

class AppBootstrap final
{
public:
    AppBootstrap();
    ~AppBootstrap();

    bool Start();
    [[nodiscard]] const char* CurrentStep() const noexcept;

private:
    const char* currentStep_ = "Préparation du démarrage";
    std::unique_ptr<AppRuntime> runtime_;
};
}
