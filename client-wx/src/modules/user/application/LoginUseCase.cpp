#include "modules/user/application/LoginUseCase.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/text/UiTexts.h"
#include "shared/text/StringUtils.h"

namespace lila::modules::user::application
{
LoginUseCase::LoginUseCase(domain::IAuthenticationService& authenticationService)
    : authenticationService_(authenticationService)
{
}

void LoginUseCase::WarmUp() const
{
    authenticationService_.WarmUp();
}

domain::AuthenticationResult LoginUseCase::Execute(const domain::LoginCredentials& credentials) const
{
    domain::LoginCredentials normalized = credentials;
    normalized.username = shared::text::TrimCopy(normalized.username);

    if (normalized.username.empty())
    {
        return domain::AuthenticationResult::Fail(lila::shared::text::ui::LoginInputUsernameRequired);
    }

    if (normalized.password.empty())
    {
        return domain::AuthenticationResult::Fail(lila::shared::text::ui::LoginInputPasswordRequired);
    }

    return authenticationService_.Login(normalized);
}
}
