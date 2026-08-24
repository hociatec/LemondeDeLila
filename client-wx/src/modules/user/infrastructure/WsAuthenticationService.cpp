#include "modules/user/infrastructure/WsAuthenticationService.h"

#include <exception>

#include "modules/user/infrastructure/remote/JwtLoginClaimsParser.h"
#include "modules/user/infrastructure/remote/UserAuthRemoteDataSource.h"
#include "shared/errors/ErrorMessages.h"

namespace lila::modules::user::infrastructure
{
WsAuthenticationService::WsAuthenticationService(remote::UserAuthRemoteDataSource& remoteDataSource)
    : remoteDataSource_(remoteDataSource)
{
}

domain::AuthenticationResult WsAuthenticationService::Login(const domain::LoginCredentials& credentials)
{
    const auto response = remoteDataSource_.Login(credentials.username, credentials.password);

    if (!response.success)
    {
        return domain::AuthenticationResult::Fail(lila::shared::errors::WithDetails(
            lila::shared::errors::AuthenticationFailed,
            response.errorMessage));
    }

    try
    {
        const auto payload = remote::UserAuthRemoteDataSource::ParseLoginPayload(response);
        if (payload.token.empty())
        {
            return domain::AuthenticationResult::Fail(lila::shared::errors::AuthenticationMissingToken);
        }

        const auto claims = remote::JwtLoginClaimsParser::Parse(payload.token);
        const std::string resolvedUsername = payload.username.empty() ? claims.username : payload.username;
        const int resolvedUserId = payload.userId == 0 ? claims.userId : payload.userId;
        return domain::AuthenticationResult::Ok(
            resolvedUsername,
            payload.token,
            resolvedUserId,
            claims.expiresAt);
    }
    catch (const std::exception& exception)
    {
        return domain::AuthenticationResult::Fail(exception.what());
    }
}

domain::RegistrationResult WsAuthenticationService::Register(const domain::RegisterRequest& request)
{
    const auto response = remoteDataSource_.Register(request.username, request.email, request.password);

    if (!response.success)
    {
        return domain::RegistrationResult::Fail(lila::shared::errors::WithDetails(
            lila::shared::errors::RegistrationFailed,
            response.errorMessage));
    }

    (void)remote::UserAuthRemoteDataSource::ParseRegisterPayload(response);
    return domain::RegistrationResult::Ok(request.username);
}
}
