#pragma once

#include "shared/security/SecurityUtils.h"

#include <cstdint>
#include <ctime>
#include <string>

namespace lila::modules::session::domain
{
struct Session
{
    std::int64_t userId = 0;
    std::string username;
    std::string token;
    std::int64_t expiresAt = 0;

    ~Session()
    {
        ClearSecret();
    }

    Session() = default;
    Session(const Session& other) = default;
    Session& operator=(const Session& other) = default;
    Session(Session&& other) noexcept = default;
    Session& operator=(Session&& other) noexcept = default;

    void ClearSecret()
    {
        lila::shared::security::SecureWipeString(token);
    }

    [[nodiscard]] bool IsAuthenticated() const
    {
        if (userId <= 0 || username.empty() || token.empty())
        {
            return false;
        }

        // Basic JWT structural check: must contain two dots (3 parts: header.payload.signature)
        const auto firstDot = token.find('.');
        if (firstDot == std::string::npos || firstDot == 0)
        {
            return false;
        }
        const auto secondDot = token.find('.', firstDot + 1);
        if (secondDot == std::string::npos || secondDot == firstDot + 1 || secondDot == token.size() - 1)
        {
            return false;
        }

        if (expiresAt > 0)
        {
            const std::int64_t now = static_cast<std::int64_t>(std::time(nullptr));
            if (now >= expiresAt)
            {
                return false;
            }
        }

        return true;
    }
};
}
