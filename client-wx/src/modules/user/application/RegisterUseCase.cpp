#include "modules/user/application/RegisterUseCase.h"
#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/text/presentation/catalog/UiTexts.h"
#include "shared/text/domain/StringUtils.h"

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
        return domain::RegistrationResult::Fail(lila::shared::text::ui::RegisterInputUsernameRequired);
    }

    if (normalized.email.empty())
    {
        return domain::RegistrationResult::Fail(lila::shared::text::ui::RegisterInputEmailRequired);
    }

    if (normalized.password.empty())
    {
        return domain::RegistrationResult::Fail(lila::shared::text::ui::RegisterInputPasswordRequired);
    }

    return authenticationService_.Register(normalized);
}
}
