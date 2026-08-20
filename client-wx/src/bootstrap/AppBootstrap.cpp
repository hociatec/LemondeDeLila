#include "bootstrap/AppBootstrap.h"

#include "bootstrap/AppRuntime.h"
#include "shared/logging/Logger.h"

#include <exception>
#include <string>

namespace lila::bootstrap
{
AppBootstrap::AppBootstrap() = default;

AppBootstrap::~AppBootstrap() = default;

const char* AppBootstrap::CurrentStep() const noexcept
{
    return currentStep_;
}

bool AppBootstrap::Start()
{
    const auto setStep = [this](const char* step)
    {
        currentStep_ = step;
        lila::shared::logging::LogInfo("Startup", std::string("Étape: ") + step);
    };

    try
    {
        setStep("Préparation du démarrage");
        runtime_ = std::make_unique<AppRuntime>();
        runtime_->Assemble(setStep);

        setStep("Démarrage de l'écran principal");
        const bool started = runtime_->StartNavigator();
        lila::shared::logging::LogInfo("Startup", "Bootstrap terminé avec succès.");
        return started;
    }
    catch (const std::exception& error)
    {
        const std::string message =
            std::string("Erreur de démarrage à l'étape '") + currentStep_ + "': " + error.what();
        lila::shared::logging::LogError("Startup", message);
        return false;
    }
    catch (...)
    {
        const std::string message = std::string("Erreur inconnue à l'étape '") + currentStep_ + "'.";
        lila::shared::logging::LogError("Startup", message);
        return false;
    }
}
}
