#include "modules/user/infrastructure/remote/JwtLoginClaimsParser.h"

#include "modules/user/infrastructure/remote/UserAuthFields.h"
#include "shared/data/JsonReaders.h"
#include "shared/security/JwtPayload.h"

namespace lila::modules::user::infrastructure::remote
{
JwtLoginClaims JwtLoginClaimsParser::Parse(const std::string& token)
{
    const auto payload = lila::shared::security::DecodeJwtPayload(token);

    JwtLoginClaims claims;
    claims.username = lila::shared::data::json::ReadRequiredString(
        payload,
        lila::modules::user::infrastructure::remote::fields::Username.data());
    claims.userId = lila::shared::data::json::ReadRequiredInteger(
        payload,
        lila::modules::user::infrastructure::remote::fields::JwtUserId.data());
    claims.expiresAt = lila::shared::security::ReadJwtExpirationClaim(payload);
    return claims;
}
}
