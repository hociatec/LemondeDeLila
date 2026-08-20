#pragma once

namespace lila::shared::errors
{
inline constexpr const char* UnexpectedError = "Une erreur inattendue est survenue.";
inline constexpr const char* InvalidRealtimeResponse = "La réponse temps réel est invalide.";
inline constexpr const char* RealtimeRequestMismatch = "La réponse temps réel ne correspond pas à la requête envoyée.";
inline constexpr const char* RealtimeServerError = "Erreur temps réel.";
inline constexpr const char* BackendRejectedRequest = "Le backend a refusé la requête.";
inline constexpr const char* InvalidSessionFile = "Le fichier de session est invalide.";
inline constexpr const char* InvalidOptionsFile = "Le fichier d'options est invalide.";
inline constexpr const char* InvalidJsonFile = "Le fichier JSON est invalide.";
inline constexpr const char* CorruptedJsonFile = "Le fichier JSON est corrompu.";
inline constexpr const char* InvalidSessionUnauthenticated = "Impossible de sauvegarder une session non authentifiée.";
inline constexpr const char* InvalidOptionsRepository = "Dépôt d'options requis.";
inline constexpr const char* OptionsSaveFailed = "Impossible de sauvegarder les options.";
inline constexpr const char* InvalidSessionRepository = "Dépôt de session requis.";
inline constexpr const char* Utf8DecodeFailed = "Le texte UTF-8 reçu est invalide.";
inline constexpr const char* Utf8EncodeFailed = "La conversion Unicode vers UTF-8 a échoué.";
inline constexpr const char* Utf8ToWideConversionFailed = "La conversion UTF-8 vers Unicode a échoué.";
inline constexpr const char* JsonFileOpenFailed = "Impossible d'ouvrir le fichier JSON.";
inline constexpr const char* JsonFileReadFailed = "Impossible de lire le fichier JSON.";
inline constexpr const char* JsonFileTooLarge = "Le fichier JSON dépasse la taille maximale autorisée.";
inline constexpr const char* InvalidSessionSaveFailed = "Impossible de sauvegarder la session.";
inline constexpr const char* FileSessionDeleteFailed = "Impossible de supprimer le fichier de session.";
inline constexpr const char* SessionExpiredMessage = "Session invalide. Veuillez vous reconnecter.";
inline constexpr const char* NoActiveSession = "Aucune session active.";
inline constexpr const char* ActionInProgress = "Une action est déjà en cours.";
}
