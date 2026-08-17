#pragma once

#include "modules/user/domain/IAuthenticationService.h"
#include "modules/user/domain/RegisterRequest.h"
#include "modules/user/domain/RegistrationResult.h"

namespace lila::modules::user::application
{
class RegisterUseCase final
{
public:
    explicit RegisterUseCase(domain::IAuthenticationService& authenticationService);

    [[nodiscard]] domain::RegistrationResult Execute(const domain::RegisterRequest& request) const;

private:
    domain::IAuthenticationService& authenticationService_;
};
}
