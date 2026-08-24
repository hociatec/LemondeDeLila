#pragma once

#include <cstdint>
#include <string>
#include <utility>

#include "shared/text/presentation/catalog/UiTexts.h"

namespace lila::modules::user::domain
{
struct AuthenticationResult
{
    bool success = false;
    bool rememberSession = false;
    std::string message;
    std::string token;
    std::string refreshToken;
    int userId = 0;
    std::int64_t expiresAt = 0;
    std::string username;

    [[nodiscard]] static AuthenticationResult Ok(
        std::string resolvedUsername,
        std::string resolvedToken,
        std::string resolvedRefreshToken,
        int resolvedUserId,
        std::int64_t resolvedExpiresAt)
    {
        AuthenticationResult result;
        result.success = true;
        result.message = lila::shared::text::ui::AuthenticationSuccessMessage.str();
        result.token = std::move(resolvedToken);
        result.refreshToken = std::move(resolvedRefreshToken);
        result.userId = resolvedUserId;
        result.expiresAt = resolvedExpiresAt;
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
