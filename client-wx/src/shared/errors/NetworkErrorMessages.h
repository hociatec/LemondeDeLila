#pragma once

namespace lila::shared::errors
{
inline constexpr const char* InvalidHttpEndpoint = "Impossible d'analyser l'endpoint WS.";
inline constexpr const char* HttpResponseReadFailed = "Lecture de la réponse HTTP impossible.";
inline constexpr const char* HttpSessionCreationFailed = "Création de la session HTTP impossible.";
inline constexpr const char* HttpTimeoutConfigurationFailed = "Configuration du timeout HTTP impossible.";
inline constexpr const char* HttpConnectFailed = "Connexion HTTP impossible.";
inline constexpr const char* HttpRequestCreationFailed = "Création de la requête HTTP impossible.";
inline constexpr const char* HttpAuthorizationHeaderFailed = "Ajout de l'en-tête Authorization impossible.";
inline constexpr const char* HttpSendRequestFailed = "Envoi de la requête ticket WS impossible.";
inline constexpr const char* HttpResponseReceivedFailed = "Réponse ticket WS impossible.";
inline constexpr const char* HttpStatusReadFailed = "Lecture du statut HTTP impossible.";
inline constexpr const char* WsTicketResponseInvalid = "La réponse du ticket WS est invalide.";
inline constexpr const char* WsTicketSchemaUnsupported = "Le schéma WS n'est pas supporté.";
inline constexpr const char* WsTicketUnavailable = "Impossible d'obtenir un ticket WebSocket.";
inline constexpr const char* WsTicketScopeInvalid = "Le scope de ticket WS est invalide.";
inline constexpr const char* WsTicketAuthTokenRequired = "Le jeton d'authentification est requis.";
inline constexpr const char* WsTicketMissing = "L'API n'a pas renvoyé de ticket WS.";
inline constexpr const char* WsTicketUnsupportedTransport = "Le ticket WS n'est disponible que sous Windows.";
inline constexpr const char* WsTicketRejectedByApiPrefix = "Ticket WS refusé par l'API (HTTP ";
inline constexpr const char* WsTicketAuthInvalidOrExpired = " Le jeton d'authentification est invalide ou expiré.";
inline constexpr const char* WinHttpSessionCreationFailed = "Création de la session WinHTTP impossible.";
inline constexpr const char* WinHttpTimeoutConfigurationFailed = "Configuration du timeout WinHTTP impossible.";
inline constexpr const char* WinHttpConnectFailed = "Connexion WinHTTP impossible.";
inline constexpr const char* WinHttpRequestCreationFailed = "Création de la requête WinHTTP impossible.";
inline constexpr const char* WinHttpNoActiveConnection = "Aucune connexion WebSocket active.";
inline constexpr const char* WinHttpEndpointParseFailed = "Impossible d'analyser l'endpoint WS.";
inline constexpr const char* WinHttpUpgradeFailed = "Échec de la mise à niveau WebSocket.";
inline constexpr const char* WinHttpUpgradeUnexpectedStatus = "Le serveur a refusé la mise à niveau WebSocket (statut HTTP).";
inline constexpr const char* WinHttpHeadersFailed = "Configuration des en-têtes WebSocket impossible.";
inline constexpr const char* WinHttpHandshakeSendFailed = "Échec d'envoi de la poignée de main WS.";
inline constexpr const char* WinHttpHandshakeResponseFailed = "Échec de la réponse de poignée de main WS.";
inline constexpr const char* WinHttpReceiveFailed = "Réception temps réel échouée.";
inline constexpr const char* WinHttpSocketClosed = "Le socket temps réel a été fermé par le serveur.";
inline constexpr const char* RealtimeSendFailed = "Envoi temps réel échoué.";
inline constexpr const char* WinHttpUnsupportedTransport = "Le transport WebSocket n'est disponible que sous Windows.";
}
