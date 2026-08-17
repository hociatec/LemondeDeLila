#pragma once

#include <string>

namespace lila::modules::user::domain
{
struct RegisterRequest
{
    std::string username;
    std::string email;
    std::string password;
};
}
