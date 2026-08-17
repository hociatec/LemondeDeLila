#include "modules/user/application/LoginUseCase.h"
#include "shared/errors/ErrorMessages.h"

#include "shared/text/StringUtils.h"

namespace lila::modules::user::application
{
LoginUseCase::LoginUseCase(domain::IAuthenticationService& authenticationService)
    : authenticationService_(authenticationService)
{
}

domain::AuthenticationResult LoginUseCase::Execute(const domain::LoginCredentials& credentials) const
{
    domain::LoginCredentials normalized = credentials;
    normalized.username = shared::text::TrimCopy(normalized.username);

    if (normalized.username.empty())
    {
        return domain::AuthenticationResult::Fail(lila::shared::errors::LoginInputUsernameRequired);
    }

    if (normalized.password.empty())
    {
        return domain::AuthenticationResult::Fail(lila::shared::errors::LoginInputPasswordRequired);
    }

    return authenticationService_.Login(normalized);
}
}
