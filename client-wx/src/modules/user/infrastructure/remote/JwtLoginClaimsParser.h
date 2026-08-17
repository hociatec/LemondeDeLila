#pragma once

#include <string>

namespace lila::modules::user::infrastructure::remote
{
struct JwtLoginClaims
{
    std::string username;
    int userId = 0;
};

class JwtLoginClaimsParser final
{
public:
    [[nodiscard]] static JwtLoginClaims Parse(const std::string& token);
};
}
