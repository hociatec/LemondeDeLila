#include "modules/user/infrastructure/remote/JwtLoginClaimsParser.h"
#include "shared/contracts/BackendWsContracts.h"
#include "shared/data/JsonReaders.h"
#include "shared/errors/ErrorMessages.h"

#include <array>
#include <cctype>
#include <cstdint>
#include <stdexcept>
#include <string_view>

#include <nlohmann/json.hpp>

namespace lila::modules::user::infrastructure::remote
{
namespace
{
std::string_view ExtractPayloadSegment(const std::string& token)
{
    const std::size_t firstSeparator = token.find('.');
    if (firstSeparator == std::string::npos)
    {
        throw std::runtime_error(lila::shared::errors::JwtTokenInvalid);
    }

    const std::size_t secondSeparator = token.find('.', firstSeparator + 1);
    if (secondSeparator == std::string::npos || secondSeparator == firstSeparator + 1)
    {
        throw std::runtime_error(lila::shared::errors::JwtTokenInvalid);
    }

    return std::string_view(token).substr(firstSeparator + 1, secondSeparator - firstSeparator - 1);
}

std::uint8_t DecodeBase64UrlCharacter(const char c)
{
    if (c >= 'A' && c <= 'Z')
    {
        return static_cast<std::uint8_t>(c - 'A');
    }

    if (c >= 'a' && c <= 'z')
    {
        return static_cast<std::uint8_t>(26 + (c - 'a'));
    }

    if (c >= '0' && c <= '9')
    {
        return static_cast<std::uint8_t>(52 + (c - '0'));
    }

    if (c == '-')
    {
        return 62;
    }

    if (c == '_')
    {
        return 63;
    }

    throw std::runtime_error(lila::shared::errors::JwtTokenInvalid);
}

std::string DecodeBase64Url(std::string_view encoded)
{
    std::string decoded;
    decoded.reserve((encoded.size() * 3U) / 4U);

    std::array<int, 4> quartet = {-1, -1, -1, -1};
    std::size_t quartetSize = 0;

    for (const char c : encoded)
    {
        if (std::isspace(static_cast<unsigned char>(c)) != 0)
        {
            continue;
        }

        quartet[quartetSize++] = DecodeBase64UrlCharacter(c);
        if (quartetSize != 4)
        {
            continue;
        }

        decoded.push_back(static_cast<char>((quartet[0] << 2) | (quartet[1] >> 4)));
        decoded.push_back(static_cast<char>(((quartet[1] & 0x0F) << 4) | (quartet[2] >> 2)));
        decoded.push_back(static_cast<char>(((quartet[2] & 0x03) << 6) | quartet[3]));
        quartet = {-1, -1, -1, -1};
        quartetSize = 0;
    }

    if (quartetSize == 2)
    {
        decoded.push_back(static_cast<char>((quartet[0] << 2) | (quartet[1] >> 4)));
    }
    else if (quartetSize == 3)
    {
        decoded.push_back(static_cast<char>((quartet[0] << 2) | (quartet[1] >> 4)));
        decoded.push_back(static_cast<char>(((quartet[1] & 0x0F) << 4) | (quartet[2] >> 2)));
    }
    else if (quartetSize != 0)
    {
        throw std::runtime_error(lila::shared::errors::JwtTokenInvalid);
    }

    return decoded;
}

}

JwtLoginClaims JwtLoginClaimsParser::Parse(const std::string& token)
{
    const auto payloadSegment = ExtractPayloadSegment(token);
    const auto decodedPayload = DecodeBase64Url(payloadSegment);
    const auto payloadJson = lila::shared::data::json::ParseDocument(decodedPayload, lila::shared::errors::JwtPayloadInvalid);

    if (!payloadJson.is_object())
    {
        throw std::runtime_error(lila::shared::errors::JwtPayloadMustBeObject);
    }

    JwtLoginClaims claims;
    claims.username = lila::shared::data::json::ReadRequiredString(
        payloadJson,
        lila::shared::contracts::user::UsernameField.data());
    claims.userId = lila::shared::data::json::ReadRequiredInteger(
        payloadJson,
        lila::shared::contracts::user::JwtUserIdField.data());
    return claims;
}

}
