#pragma once

namespace lila::shared::errors
{
inline constexpr const char* NoActiveLeaderboardSession = "Aucune session active pour le classement.";
inline constexpr const char* LeaderboardLoadFailed = "Chargement du classement impossible.";
inline constexpr const char* LeaderboardPayloadInvalid = "La reponse du classement est invalide.";
}
