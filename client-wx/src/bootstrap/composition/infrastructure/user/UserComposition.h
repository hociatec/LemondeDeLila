#pragma once

#include <memory>

#include "bootstrap/composition/application/StepLogger.h"

namespace lila::modules::options::application
{
class OptionsStore;
}

namespace lila::modules::session::application
{
class SessionStore;
}

namespace lila::modules::user::application
{
class LoginUseCase;
class RegisterUseCase;
}

namespace lila::modules::user::domain
{
class IAuthenticationService;
}

namespace lila::modules::user::infrastructure::remote
{
class UserAuthRemoteDataSource;
}

namespace lila::bootstrap
{
struct NetworkComposition;

struct UserComposition final
{
    UserComposition();
    ~UserComposition();

    void AssembleAuthentication(NetworkComposition& network, const StepLogger& setStep);
    void LoadLocalStores(const StepLogger& setStep);

    std::unique_ptr<lila::modules::user::infrastructure::remote::UserAuthRemoteDataSource>
        userAuthRemoteDataSource;
    std::unique_ptr<lila::modules::user::domain::IAuthenticationService> authenticationService;
    std::unique_ptr<lila::modules::user::application::LoginUseCase> loginUseCase;
    std::unique_ptr<lila::modules::user::application::RegisterUseCase> registerUseCase;
    std::unique_ptr<lila::modules::session::application::SessionStore> sessionStore;
    std::unique_ptr<lila::modules::options::application::OptionsStore> optionsStore;
};
}
