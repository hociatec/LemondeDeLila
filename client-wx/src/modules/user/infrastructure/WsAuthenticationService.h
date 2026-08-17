#pragma once

#include "modules/user/domain/IAuthenticationService.h"

namespace lila::modules::user::infrastructure::remote
{
class UserAuthRemoteDataSource;
}

namespace lila::modules::user::infrastructure
{
class WsAuthenticationService final : public domain::IAuthenticationService
{
public:
    explicit WsAuthenticationService(remote::UserAuthRemoteDataSource& remoteDataSource);

    [[nodiscard]] domain::AuthenticationResult Login(const domain::LoginCredentials& credentials) override;
    [[nodiscard]] domain::RegistrationResult Register(const domain::RegisterRequest& request) override;

private:
    remote::UserAuthRemoteDataSource& remoteDataSource_;
};
}
