#pragma once

#include "modules/user/domain/AuthenticationResult.h"
#include "modules/user/domain/LoginCredentials.h"
#include "modules/user/domain/RegisterRequest.h"
#include "modules/user/domain/RegistrationResult.h"

namespace lila::modules::user::domain
{
class IAuthenticationService
{
public:
    virtual ~IAuthenticationService() = default;

    [[nodiscard]] virtual AuthenticationResult Login(const LoginCredentials& credentials) = 0;
    [[nodiscard]] virtual RegistrationResult Register(const RegisterRequest& request) = 0;
};
}
