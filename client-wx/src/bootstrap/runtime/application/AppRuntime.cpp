#include "bootstrap/runtime/application/AppRuntime.h"

#include "app/navigation/presentation/AppNavigator.h"
#include "modules/audio/application/IAudioService.h"

namespace lila::bootstrap
{
AppRuntime::AppRuntime() = default;

AppRuntime::~AppRuntime() = default;

void AppRuntime::Assemble(const StepLogger& setStep)
{
    network_.Assemble(setStep);
    user_.AssembleAuthentication(network_, setStep);
    user_.LoadLocalStores(setStep);
    audio_.Assemble(*user_.optionsStore, setStep);
    game_.Assemble(network_, *user_.sessionStore, setStep);
    social_.Assemble(
        network_,
        *user_.sessionStore,
        *user_.optionsStore,
        *audio_.audioService,
        setStep);
    CreateNavigator(setStep);
}

bool AppRuntime::StartNavigator() const
{
    return navigator_ != nullptr && navigator_->Start();
}

void AppRuntime::CreateNavigator(const StepLogger& setStep)
{
    setStep("Creation du navigateur");
    app::navigation::AuthNavigationDependencies auth{
        *user_.loginUseCase,
        *user_.registerUseCase,
        *user_.sessionStore,
        *user_.optionsStore};
    app::navigation::GameNavigationDependencies game{
        *game_.catalogService,
        *game_.roomLobbyService,
        *game_.roomSessionService,
        *game_.vaultService,
        *game_.storyBookService,
        *game_.leaderboardService};
    app::navigation::SocialNavigationDependencies social{
        *social_.chatService,
        *social_.messagingService,
        *social_.socialService,
        *social_.presenceMonitor};
    app::navigation::AudioNavigationDependencies audio{*audio_.audioService};
    navigator_ = std::make_unique<app::navigation::AppNavigator>(auth, game, social, audio);
}
}
