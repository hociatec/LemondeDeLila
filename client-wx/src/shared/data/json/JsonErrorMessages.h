#pragma once

namespace lila::shared::errors
{
inline constexpr const char* JsonObjectRequired = " doit être un objet JSON.";
inline constexpr const char* JsonArrayRequired = " doit être un tableau JSON.";
inline constexpr const char* JsonFieldNamePrefix = "Le champ JSON '";
inline constexpr const char* JsonFieldNameRequiredPrefix = "Le champ JSON requis '";
inline constexpr const char* JsonFieldTypeStringSuffix = "' doit être une chaîne.";
inline constexpr const char* JsonFieldTypeIntegerSuffix = "' doit être un entier.";
inline constexpr const char* JsonFieldTypeBooleanSuffix = "' doit être un booléen.";
inline constexpr const char* JsonFieldTypeStringRequiredSuffix = "' doit être une chaîne.";
inline constexpr const char* JsonFieldTypeIntegerRequiredSuffix = "' doit être un entier.";
inline constexpr const char* JsonFieldTypeArrayPrefix = "Le tableau ";
}
