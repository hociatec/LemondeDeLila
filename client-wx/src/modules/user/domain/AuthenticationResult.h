#pragma once

#include <cstdint>
#include <string>
#include <utility>
#include <vector>

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
    std::vector<std::string> roles;

    [[nodiscard]] static AuthenticationResult Ok(
        std::string resolvedUsername,
        std::string resolvedToken,
        std::string resolvedRefreshToken,
        int resolvedUserId,
        std::int64_t resolvedExpiresAt,
        std::vector<std::string> resolvedRoles)
    {
        AuthenticationResult result;
        result.success = true;
        result.token = std::move(resolvedToken);
        result.refreshToken = std::move(resolvedRefreshToken);
        result.userId = resolvedUserId;
        result.expiresAt = resolvedExpiresAt;
        result.username = std::move(resolvedUsername);
        result.roles = std::move(resolvedRoles);
        return result;
    }

    [[nodiscard]] static AuthenticationResult Fail(std::string error = {})
    {
        AuthenticationResult result;
        result.success = false;
        result.message = std::move(error);
        return result;
    }
};
}
