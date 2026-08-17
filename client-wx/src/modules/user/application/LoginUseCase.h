#pragma once

#include "modules/user/domain/AuthenticationResult.h"
#include "modules/user/domain/IAuthenticationService.h"
#include "modules/user/domain/LoginCredentials.h"

namespace lila::modules::user::application
{
class LoginUseCase final
{
public:
    explicit LoginUseCase(domain::IAuthenticationService& authenticationService);

    [[nodiscard]] domain::AuthenticationResult Execute(const domain::LoginCredentials& credentials) const;

private:
    domain::IAuthenticationService& authenticationService_;
};
}
