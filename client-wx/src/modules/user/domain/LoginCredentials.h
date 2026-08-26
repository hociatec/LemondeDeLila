#pragma once

#include <string>

namespace lila::modules::user::domain
{
struct LoginCredentials
{
    std::string username;
    std::string password;

};
}
