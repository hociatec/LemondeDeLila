#include "bootstrap/composition/infrastructure/user/UserComposition.h"

#include <memory>

#include "bootstrap/composition/infrastructure/network/NetworkComposition.h"
#include "modules/options/application/OptionsStore.h"
#include "modules/options/infrastructure/FileOptionsRepository.h"
#include "modules/session/application/SessionStore.h"
#include "modules/session/infrastructure/FileSessionRepository.h"
#include "modules/user/application/LoginUseCase.h"
#include "modules/user/application/RegisterUseCase.h"
#include "modules/user/domain/IAuthenticationService.h"
#include "modules/user/infrastructure/WsAuthenticationService.h"
#include "modules/user/infrastructure/WsSessionRefresher.h"
#include "modules/user/infrastructure/remote/UserAuthRemoteDataSource.h"
#include "shared/network/application/realtime/RealtimeApiClient.h"

namespace lila::bootstrap
{
UserComposition::UserComposition() = default;
UserComposition::~UserComposition() = default;

void UserComposition::AssembleAuthentication(NetworkComposition& network, const StepLogger& setStep)
{
    setStep("Creation des services d'authentification");
    userAuthRemoteDataSource =
        std::make_unique<modules::user::infrastructure::remote::UserAuthRemoteDataSource>(
            *network.realtimeApiClient);
    authenticationService =
        std::make_unique<modules::user::infrastructure::WsAuthenticationService>(
            *userAuthRemoteDataSource);
    loginUseCase = std::make_unique<modules::user::application::LoginUseCase>(*authenticationService);
    registerUseCase =
        std::make_unique<modules::user::application::RegisterUseCase>(*authenticationService);
}

void UserComposition::LoadLocalStores(const StepLogger& setStep)
{
    setStep("Chargement des options");
    optionsStore = std::make_unique<modules::options::application::OptionsStore>(
        std::make_unique<modules::options::infrastructure::FileOptionsRepository>());
    optionsStore->Load();

    setStep("Creation du store de session");
    sessionStore = std::make_unique<modules::session::application::SessionStore>(
        std::make_unique<modules::session::infrastructure::FileSessionRepository>(),
        std::make_unique<modules::user::infrastructure::WsSessionRefresher>(
            *userAuthRemoteDataSource));
}
}
