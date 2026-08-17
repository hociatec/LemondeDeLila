#pragma once

#include <string>

namespace lila::modules::user::domain
{
struct LoginCredentials
{
    std::string username;
    std::string password;

    [[nodiscard]] bool IsComplete() const
    {
        return !username.empty() && !password.empty();
    }
};
}
