#include "shared/security/domain/JwtPayload.h"

#include <array>
#include <cctype>
#include <cstdint>
#include <stdexcept>
#include <string_view>

#include <nlohmann/json.hpp>

#include "shared/data/json/JsonReaders.h"
#include "shared/security/domain/SecurityErrorMessages.h"

namespace lila::shared::security
{
namespace
{
std::string_view ExtractPayloadSegment(const std::string& token)
{
    const auto firstSeparator = token.find('.');
    const auto secondSeparator = firstSeparator == std::string::npos
        ? std::string::npos
        : token.find('.', firstSeparator + 1);
    if (firstSeparator == std::string::npos || secondSeparator == std::string::npos ||
        secondSeparator == firstSeparator + 1)
    {
        throw std::runtime_error(lila::shared::errors::JwtTokenInvalid);
    }
    return std::string_view(token).substr(firstSeparator + 1, secondSeparator - firstSeparator - 1);
}

std::uint8_t DecodeCharacter(char character)
{
    if (character >= 'A' && character <= 'Z') return static_cast<std::uint8_t>(character - 'A');
    if (character >= 'a' && character <= 'z') return static_cast<std::uint8_t>(26 + character - 'a');
    if (character >= '0' && character <= '9') return static_cast<std::uint8_t>(52 + character - '0');
    if (character == '-') return 62;
    if (character == '_') return 63;
    throw std::runtime_error(lila::shared::errors::JwtTokenInvalid);
}

std::string DecodeBase64Url(std::string_view encoded)
{
    std::string decoded;
    decoded.reserve((encoded.size() * 3U) / 4U);
    std::array<int, 4> quartet{-1, -1, -1, -1};
    std::size_t quartetSize = 0;
    for (const char character : encoded)
    {
        if (std::isspace(static_cast<unsigned char>(character)) != 0) continue;
        quartet[quartetSize++] = DecodeCharacter(character);
        if (quartetSize != 4) continue;
        decoded.push_back(static_cast<char>((quartet[0] << 2) | (quartet[1] >> 4)));
        decoded.push_back(static_cast<char>(((quartet[1] & 0x0F) << 4) | (quartet[2] >> 2)));
        decoded.push_back(static_cast<char>(((quartet[2] & 0x03) << 6) | quartet[3]));
        quartetSize = 0;
    }
    if (quartetSize == 2)
        decoded.push_back(static_cast<char>((quartet[0] << 2) | (quartet[1] >> 4)));
    else if (quartetSize == 3)
    {
        decoded.push_back(static_cast<char>((quartet[0] << 2) | (quartet[1] >> 4)));
        decoded.push_back(static_cast<char>(((quartet[1] & 0x0F) << 4) | (quartet[2] >> 2)));
    }
    else if (quartetSize != 0)
        throw std::runtime_error(lila::shared::errors::JwtTokenInvalid);
    return decoded;
}
}

nlohmann::json DecodeJwtPayload(const std::string& token)
{
    auto payload = lila::shared::data::json::ParseDocument(
        DecodeBase64Url(ExtractPayloadSegment(token)),
        lila::shared::errors::JwtPayloadInvalid);
    if (!payload.is_object()) throw std::runtime_error(lila::shared::errors::JwtPayloadMustBeObject);
    return payload;
}

std::int64_t ReadJwtExpirationClaim(const nlohmann::json& payload)
{
    const auto expiration = payload.find("exp");
    if (expiration == payload.end() || !expiration->is_number_integer())
        throw std::runtime_error(lila::shared::errors::JwtTokenInvalid);
    return expiration->get<std::int64_t>();
}

std::int64_t ReadJwtExpiration(const std::string& token)
{
    return ReadJwtExpirationClaim(DecodeJwtPayload(token));
}
}
