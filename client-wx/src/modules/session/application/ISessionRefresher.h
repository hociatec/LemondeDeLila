#pragma once

#include <cstdint>
#include <stop_token>
#include <string>

namespace lila::modules::session::application
{
struct SessionRefreshResult final
{
    bool success = false;
    bool rejected = false;
    std::string token;
    std::string refreshToken;
    std::int64_t expiresAt = 0;
    std::string errorMessage;
};

class ISessionRefresher
{
public:
    virtual ~ISessionRefresher() = default;
    [[nodiscard]] virtual SessionRefreshResult Refresh(
        const std::string& refreshToken,
        std::stop_token stopToken = {}) = 0;
    [[nodiscard]] virtual bool Revoke(
        const std::string& refreshToken,
        std::stop_token stopToken = {}) = 0;
};
}
