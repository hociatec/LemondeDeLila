#pragma once

namespace lila::shared::errors
{
inline constexpr const char* AuthenticationFailed = "La connexion a échoué.";
inline constexpr const char* AuthenticationMissingToken = "Le backend n'a pas renvoyé de jeton.";
inline constexpr const char* RegistrationFailed = "Inscription impossible.";
inline constexpr const char* LoginParseFailed = "Impossible d'analyser une connexion en échec.";
inline constexpr const char* RegisterParseFailed = "Impossible d'analyser une inscription en échec.";
inline constexpr const char* AuthResponsePayloadMustBeObject = "La charge utile de connexion doit être un objet JSON.";
inline constexpr const char* AuthenticationSuccessMessage = "Connexion réussie.";
inline constexpr const char* RegistrationSuccessMessage = "Compte créé, vous pouvez vous connecter.";
}
