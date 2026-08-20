#pragma once

#include <string>

#include "shared/text/UiTexts.h"

namespace lila::modules::user::domain
{
struct AuthenticationResult
{
    bool success = false;
    bool rememberSession = false;
    std::string message;
    std::string token;
    int userId = 0;
    std::string username;

    [[nodiscard]] static AuthenticationResult Ok(std::string resolvedUsername, std::string resolvedToken, int resolvedUserId)
    {
        AuthenticationResult result;
        result.success = true;
        result.message = lila::shared::text::ui::AuthenticationSuccessMessage.str();
        result.token = std::move(resolvedToken);
        result.userId = resolvedUserId;
        result.username = std::move(resolvedUsername);
        return result;
    }

    [[nodiscard]] static AuthenticationResult Fail(std::string error)
    {
        AuthenticationResult result;
        result.success = false;
        result.message = std::move(error);
        return result;
    }
};
}
