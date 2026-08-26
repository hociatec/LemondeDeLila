#pragma once

namespace lila::shared::errors
{
inline constexpr const char* NoActiveSocialSession = "Aucune session active pour le réseau social.";
inline constexpr const char* SocialProfileMustBeObject = "Le profil social doit être un objet JSON.";
inline constexpr const char* SocialProfileUpdatedMustBeObject = "Le profil social mis à jour doit être un objet JSON.";
inline constexpr const char* SocialEachUserMustBeObject = "Chaque utilisateur social doit être un objet JSON.";
inline constexpr const char* SocialEachRequestMustBeObject = "Chaque demande sociale doit être un objet JSON.";
inline constexpr const char* SocialListArrayPrefix = "La liste '";
inline constexpr const char* SocialListArraySuffix = "' doit être un tableau JSON.";
inline constexpr const char* SocialEachMustBeObject = " doit être un objet JSON.";
inline constexpr const char* SocialLoadFriendsFailed = "Chargement des amis impossible.";
inline constexpr const char* SocialLoadRequestsFailed = "Chargement des demandes impossible.";
inline constexpr const char* SocialLoadBlockedUsersFailed = "Chargement des utilisateurs bloqués impossible.";
inline constexpr const char* SocialRequestFriendFailed = "Envoi de la demande impossible.";
inline constexpr const char* SocialAcceptFriendFailed = "Acceptation de la demande impossible.";
inline constexpr const char* SocialRejectFriendFailed = "Refus de la demande impossible.";
inline constexpr const char* SocialCancelRequestFailed = "Annulation de la demande impossible.";
inline constexpr const char* SocialRemoveFriendFailed = "Suppression de l'ami impossible.";
inline constexpr const char* SocialBlockUserFailed = "Blocage de l'utilisateur impossible.";
inline constexpr const char* SocialUnblockUserFailed = "Déblocage de l'utilisateur impossible.";
inline constexpr const char* SocialLoadProfileFailed = "Chargement du profil impossible.";
inline constexpr const char* SocialUpdateProfileFailed = "Mise à jour du profil impossible.";
inline constexpr const char* SocialSearchUsersFailed = "Recherche d'utilisateur impossible.";
inline constexpr const char* SocialResponsePayloadInvalidType = "La charge utile du social est invalide.";
}
