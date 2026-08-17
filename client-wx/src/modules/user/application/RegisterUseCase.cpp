#include "modules/user/application/RegisterUseCase.h"
#include "shared/errors/ErrorMessages.h"

#include "shared/text/StringUtils.h"

namespace lila::modules::user::application
{
RegisterUseCase::RegisterUseCase(domain::IAuthenticationService& authenticationService)
    : authenticationService_(authenticationService)
{
}

domain::RegistrationResult RegisterUseCase::Execute(const domain::RegisterRequest& request) const
{
    domain::RegisterRequest normalized = request;
    normalized.username = shared::text::TrimCopy(normalized.username);
    normalized.email = shared::text::TrimCopy(normalized.email);

    if (normalized.username.empty())
    {
        return domain::RegistrationResult::Fail(lila::shared::errors::RegisterInputUsernameRequired);
    }

    if (normalized.email.empty())
    {
        return domain::RegistrationResult::Fail(lila::shared::errors::RegisterInputEmailRequired);
    }

    if (normalized.password.empty())
    {
        return domain::RegistrationResult::Fail(lila::shared::errors::RegisterInputPasswordRequired);
    }

    return authenticationService_.Register(normalized);
}
}
