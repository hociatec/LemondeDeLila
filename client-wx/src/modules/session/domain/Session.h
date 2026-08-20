#pragma once

#include "shared/domain/DomainTypes.h"
#include "shared/security/SecurityUtils.h"

#include <cstdint>
#include <ctime>
#include <string>

namespace lila::modules::session::domain
{
struct Session
{
    lila::shared::domain::UserId userId{};
    std::string username;
    std::string token;
    std::string refreshToken;
    std::int64_t expiresAt = 0;

    ~Session()
    {
        ClearSecret();
    }

    Session() = default;
    Session(const Session& other)
        : userId(other.userId),
          username(other.username),
          token(other.token),
          refreshToken(other.refreshToken),
          expiresAt(other.expiresAt)
    {
    }

    Session& operator=(const Session& other)
    {
        if (this == &other)
        {
            return *this;
        }

        ClearSecret();
        userId = other.userId;
        username = other.username;
        token = other.token;
        refreshToken = other.refreshToken;
        expiresAt = other.expiresAt;
        return *this;
    }

    Session(Session&& other) noexcept
        : userId(other.userId),
          username(std::move(other.username)),
          token(std::move(other.token)),
          refreshToken(std::move(other.refreshToken)),
          expiresAt(other.expiresAt)
    {
        other.ClearSecret();
        other.expiresAt = 0;
    }

    Session& operator=(Session&& other) noexcept
    {
        if (this == &other)
        {
            return *this;
        }

        ClearSecret();
        userId = other.userId;
        username = std::move(other.username);
        token = std::move(other.token);
        refreshToken = std::move(other.refreshToken);
        expiresAt = other.expiresAt;
        other.ClearSecret();
        other.expiresAt = 0;
        return *this;
    }

    void ClearSecret()
    {
        lila::shared::security::SecureWipeString(token);
        lila::shared::security::SecureWipeString(refreshToken);
    }

    [[nodiscard]] bool IsAuthenticated() const
    {
        if (!userId.IsValid() || username.empty() || token.empty())
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
