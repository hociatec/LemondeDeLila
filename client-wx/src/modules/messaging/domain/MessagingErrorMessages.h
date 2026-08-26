#pragma once

namespace lila::shared::errors
{
inline constexpr const char* NoActiveMessagingSession = "Aucune session active pour la messagerie.";
inline constexpr const char* MessagingUsersMustBeObject = "L'utilisateur recherché doit être un objet JSON.";
inline constexpr const char* MessagingMessagesMustBeArray = "La liste des messages doit être un tableau JSON.";
inline constexpr const char* MessagingEachMessageMustBeObject = "Chaque message doit être un objet JSON.";
inline constexpr const char* MessagingMessageMustBeObject = "Le message doit être un objet JSON.";
inline constexpr const char* MessagingLoadBoxFailed = "Chargement de la messagerie impossible.";
inline constexpr const char* MessagingSendFailed = "Envoi impossible.";
inline constexpr const char* MessagingDeleteFailed = "Suppression impossible.";
inline constexpr const char* MessagingRestoreFailed = "Restauration impossible.";
inline constexpr const char* MessagingPurgeFailed = "Suppression définitive impossible.";
inline constexpr const char* MessagingSearchUserFailed = "Recherche utilisateur impossible.";
inline constexpr const char* MessagingMarkReadFailed = "Marquage lu impossible.";
inline constexpr const char* MessagingResponsePayloadInvalidType = "La charge utile de la messagerie est invalide.";
inline constexpr const char* MessagingInvalidBox = "Le type de boîte de messagerie est invalide.";
inline constexpr const char* MessagingCreatedAtMissing = "La date de création du message est absente.";
inline constexpr const char* MessagingCreatedAtInvalid = "La date de création du message est invalide.";
inline constexpr const char* MessagingRecipientNotFound = "Destinataire introuvable.";
}
