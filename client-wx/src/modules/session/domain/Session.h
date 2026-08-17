#pragma once

#include <string>

namespace lila::modules::session::domain
{
struct Session
{
    int userId = 0;
    std::string username;
    std::string token;

    [[nodiscard]] bool IsAuthenticated() const
    {
        return !token.empty();
    }
};
}
