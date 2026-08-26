#pragma once

namespace lila::shared::errors
{
inline constexpr const char* ChatDisabled = "Le tchat est désactivé dans les options.";
inline constexpr const char* ChatLoginRequired = "Authentification requise pour ouvrir le tchat.";
inline constexpr const char* ChatClosed = "Tchat fermé.";
inline constexpr const char* ChatConnecting = "Connexion au serveur...";
inline constexpr const char* ChatAuthenticating = "Authentification...";
inline constexpr const char* ChatLoadingData = "Chargement des données...";
inline constexpr const char* ChatConnectionFailed = "Connexion tchat échouée :";
inline constexpr const char* ChatConnected = "Tchat connecté.";
inline constexpr const char* ChatReconnectionInterrupted = "Connexion au serveur interrompue :";
inline constexpr const char* ChatServerRefused = "La connexion au tchat a été refusée par le serveur.";
inline constexpr const char* ChatNotConnected = "Tchat non connecté.";
inline constexpr const char* ChatErrorMessage = "Erreur tchat.";
inline constexpr const char* ChatEventInvalid = "L'événement tchat est invalide.";
inline constexpr const char* ChatEventPayloadInvalid = "La charge utile d'événement tchat est invalide.";
inline constexpr const char* ChatEventDataInvalid = "Les données de l'événement tchat sont invalides.";
inline constexpr const char* ChatSendFailed = "Envoi tchat échoué :";
inline constexpr const char* ChatEditFailed = "Modification tchat échouée :";
inline constexpr const char* ChatDeleteFailed = "Suppression tchat échouée :";
inline constexpr const char* ChatReconnectionTicketRejected = "Ticket WS refusé par l'API (HTTP ";
inline constexpr const char* ChatReconnecting = "Reconnexion au serveur...";
inline constexpr const char* ChatReconnected = "Connexion au serveur rétablie.";
inline constexpr const char* ChatHistoryLoaded = " résultats chargés.";
inline constexpr const char* ChatActionInvalidPayload = "La charge utile du message tchat doit être un objet JSON.";
inline constexpr const char* ChatMessagesMustBeArray = "Le tableau 'messages' doit être un tableau JSON.";
}
