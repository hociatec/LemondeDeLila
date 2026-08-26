#pragma once

namespace lila::shared::errors
{
inline constexpr const char* JwtTokenInvalid = "Jeton JWT invalide.";
inline constexpr const char* JwtPayloadInvalid = "Le payload JWT est invalide.";
inline constexpr const char* JwtPayloadMustBeObject = "Le payload JWT doit être un objet JSON.";
}
