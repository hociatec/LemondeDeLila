#pragma once

#include "shared/text/UiTexts.h"

#include <string>

namespace lila::shared::errors {

using namespace lila::shared::text::ui;

inline std::string WithDetails(const char* message, const std::string& details)
{
    if (details.empty())
    {
        return std::string(message);
    }

    const std::string baseMessage(message);
    if (baseMessage.empty())
    {
        return details;
    }

    if (baseMessage.back() == ':')
    {
        return baseMessage + " " + details;
    }

    if (baseMessage.back() == ' ')
    {
        return baseMessage + details;
    }

    return baseMessage + " : " + details;
}
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
inline constexpr const char* JsonFileOpenFailed = "Impossible d'ouvrir le fichier JSON.";
inline constexpr const char* JsonFileReadFailed = "Impossible de lire le fichier JSON.";
inline constexpr const char* WsTicketResponseInvalid = "La réponse du ticket WS est invalide.";
inline constexpr const char* WsTicketSchemaUnsupported = "Le schéma WS n'est pas supporté.";
inline constexpr const char* WsTicketUnavailable = "Impossible d'obtenir un ticket WebSocket.";
inline constexpr const char* WsTicketScopeInvalid = "Le scope de ticket WS est invalide.";
inline constexpr const char* WsTicketAuthTokenRequired = "Le jeton d'authentification est requis.";
inline constexpr const char* WsTicketMissing = "L'API n'a pas renvoyé de ticket WS.";
inline constexpr const char* WsTicketUnsupportedTransport = "Le ticket WS n'est disponible que sous Windows.";
inline constexpr const char* WsTicketRejectedByApiPrefix = "Ticket WS refusé par l'API (HTTP ";
inline constexpr const char* WsTicketAuthInvalidOrExpired = " Le jeton d'authentification est invalide ou expiré.";
inline constexpr const char* InvalidSessionSaveFailed = "Impossible de sauvegarder la session.";
inline constexpr const char* FileSessionDeleteFailed = "Impossible de supprimer le fichier de session.";
inline constexpr const char* SessionExpiredMessage = "Session invalide. Veuillez vous reconnecter.";
inline constexpr const char* NoActiveSession = "Aucune session active.";
inline constexpr const char* NoActiveSocialSession = "Aucune session active pour le réseau social.";
inline constexpr const char* NoActiveMessagingSession = "Aucune session active pour la messagerie.";
inline constexpr const char* ActionInProgress = "Une action est déjà en cours.";
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
inline constexpr const char* ChatFrameTitle = "Tchat - %s";
inline constexpr const char* ChatFrameHeader = "Tchat";
inline constexpr const char* ChatFrameSubtitle = "Tchat global du client";
inline constexpr const char* ChatFrameOpeningMessage = "Ouverture du tchat...";
inline constexpr const char* ChatMessagesHeader = "Messages";
inline constexpr const char* ChatNoMessage = "Aucun message.";
inline constexpr const char* ChatEditMessageAction = "Modifier le message";
inline constexpr const char* ChatDeleteMessageAction = "Supprimer le message";
inline constexpr const char* ChatYourMessageHint = "Votre message";
inline constexpr const char* ChatUnknownUser = "Inconnu";
inline constexpr const char* ChatTimeFormatUnknown = "??:??";
inline constexpr const char* ChatEditableSuffix = " - modifiable";
inline constexpr const char* ChatInputHint = "Saisissez votre message puis appuyez sur Entrée.";
inline constexpr const char* ChatInputHintAccessible = "Saisir un message";
inline constexpr const char* ChatMessagesListAccessible = "Messages du tchat";
inline constexpr const char* ChatMessagesEmptyAccessible = "Liste des messages vide";
inline constexpr const char* ChatEventInvalid = "L'événement tchat est invalide.";
inline constexpr const char* ChatEventPayloadInvalid = "La charge utile d'événement tchat est invalide.";
inline constexpr const char* ChatEventDataInvalid = "Les données de l'événement tchat sont invalides.";
inline constexpr const char* ChatSendFailed = "Envoi tchat échoué :";
inline constexpr const char* ChatEditFailed = "Modification tchat échouée :";
inline constexpr const char* ChatDeleteFailed = "Suppression tchat échouée :";
inline constexpr const char* ChatReconnectionTicketRejected = WsTicketRejectedByApiPrefix;
inline constexpr const char* ChatReconnecting = "Reconnexion au serveur...";
inline constexpr const char* ChatReconnected = "Connexion au serveur rétablie.";
inline constexpr const char* ChatHistoryLoaded = " résultats chargés.";
inline constexpr const char* ChatSendBusy = "Envoi du message...";
inline constexpr const char* ChatEditBusy = "Modification du message...";
inline constexpr const char* ChatDeleteBusy = "Suppression du message...";
inline constexpr const char* ChatSent = "Message envoyé.";
inline constexpr const char* ChatEdited = "Modification envoyée.";
inline constexpr const char* ChatDeleted = "Message supprimé.";
inline constexpr const char* ChatEditMode = "Édition du message.";
inline constexpr const char* ChatEditAborted = "Édition annulée.";
inline constexpr const char* ChatEditHint = "Saisissez votre message puis appuyez sur Entrée.";
inline constexpr const char* ChatDeleteConfirm = "Supprimer ce message ?";
inline constexpr const char* ChatCloseConfirmation = "Fermer le tchat ?";
inline constexpr const char* ChatActionInvalidPayload = "La charge utile du message tchat doit être un objet JSON.";
inline constexpr const char* ChatMessagesMustBeArray = "Le tableau 'messages' doit être un tableau JSON.";
inline constexpr const char* LoginInputUsernameRequired = "Le nom d'utilisateur est requis.";
inline constexpr const char* LoginInputPasswordRequired = "Le mot de passe est requis.";
inline constexpr const char* RegisterInputUsernameRequired = "Le nom d'utilisateur est requis.";
inline constexpr const char* RegisterInputEmailRequired = "L'adresse email est requise.";
inline constexpr const char* RegisterInputPasswordRequired = "Le mot de passe est requis.";
inline constexpr const char* AuthenticationFailed = "La connexion a échoué.";
inline constexpr const char* AuthenticationMissingToken = "Le backend n'a pas renvoyé de jeton.";
inline constexpr const char* RegistrationFailed = "Inscription impossible.";
inline constexpr const char* LoginParseFailed = "Impossible d'analyser une connexion en échec.";
inline constexpr const char* RegisterParseFailed = "Impossible d'analyser une inscription en échec.";
inline constexpr const char* AuthResponsePayloadMustBeObject = "La charge utile de connexion doit être un objet JSON.";
inline constexpr const char* AuthenticationSuccessMessage = "Connexion réussie.";
inline constexpr const char* RegistrationSuccessMessage = "Compte créé, vous pouvez vous connecter.";
inline constexpr const char* JwtTokenInvalid = "Jeton JWT invalide.";
inline constexpr const char* JwtPayloadInvalid = "Le payload JWT est invalide.";
inline constexpr const char* JwtPayloadMustBeObject = "Le payload JWT doit être un objet JSON.";
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
inline constexpr const char* KeyboardNavigationHint = "Flèches haut/bas : naviguer. Entrée : sélectionner. Échap : revenir.";
inline constexpr const char* MessagingUsersMustBeObject = "L'utilisateur recherché doit être un objet JSON.";
inline constexpr const char* MessagingMessagesMustBeArray = "La liste des messages doit être un tableau JSON.";
inline constexpr const char* MessagingEachMessageMustBeObject = "Chaque message doit être un objet JSON.";
inline constexpr const char* MessagingMessageMustBeObject = "Le message doit être un objet JSON.";
inline constexpr const char* MessagingLoadBoxFailed = "Chargement de la messagerie impossible.";
inline constexpr const char* MessagingLoadConversationFailed = "Conversation indisponible.";
inline constexpr const char* MessagingSendFailed = "Envoi impossible.";
inline constexpr const char* MessagingDeleteFailed = "Suppression impossible.";
inline constexpr const char* MessagingRestoreFailed = "Restauration impossible.";
inline constexpr const char* MessagingPurgeFailed = "Suppression définitive impossible.";
inline constexpr const char* MessagingSearchUserFailed = "Recherche utilisateur impossible.";
inline constexpr const char* MessagingMarkReadFailed = "Marquage lu impossible.";
inline constexpr const char* MessagingResponsePayloadInvalidType = "La charge utile de la messagerie est invalide.";
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
inline constexpr const char* MessagingRecipientNotFound = "Destinataire introuvable.";
inline constexpr const char* MessagingSearchSendBusy = "Chargement...";
inline constexpr const char* MessagingSendBusy = "Envoi du message...";
inline constexpr const char* MessagingDeleteBusy = "Suppression du message...";
inline constexpr const char* MessagingRestoreBusy = "Restauration du message...";
inline constexpr const char* MessagingPurgeBusy = "Suppression définitive du message...";
inline constexpr const char* MessagingRecipientRequired = "Le destinataire est requis.";
inline constexpr const char* MessagingBodyRequired = "Le message ne peut pas être vide.";
inline constexpr const char* MessagingFrameTitle = "Messagerie - %s";
inline constexpr const char* MessagingFrameHeader = "Messagerie";
inline constexpr const char* MessagingFrameSubtitle = "Boîte de réception des messages privés";
inline constexpr const char* MessagingFrameInitialStatus = "Choisissez une section.";
inline constexpr const char* MessagingFrameStatusAccessible = "État de messagerie";
inline constexpr const char* MessagingMenuCompose = "Rédiger un message";
inline constexpr const char* MessagingMenuInbox = "Boîte de réception";
inline constexpr const char* MessagingMenuOutbox = "Messages envoyés";
inline constexpr const char* MessagingMenuDeleted = "Corbeille";
inline constexpr const char* MessagingPageMenu = "Menu";
inline constexpr const char* MessagingPageList = "Liste";
inline constexpr const char* MessagingPageDetail = "Détail";
inline constexpr const char* MessagingPageCompose = "Rédaction";
inline constexpr const char* MessagingListHeader = "Boîte de messages";
inline constexpr const char* MessagingMessageDetail = "Détail du message";
inline constexpr const char* MessagingComposeTitle = "Rédiger un message";
inline constexpr const char* MessagingComposeRecipient = "Destinataire";
inline constexpr const char* MessagingComposeSubject = "Sujet";
inline constexpr const char* MessagingComposeBody = "Message";
inline constexpr const char* MessagingSendButton = "Envoyer";
inline constexpr const char* MessagingCancelButton = "Annuler";
inline constexpr const char* MessagingReplyButton = "Répondre";
inline constexpr const char* MessagingDeleteButton = "Supprimer";
inline constexpr const char* MessagingRestoreButton = "Restaurer";
inline constexpr const char* MessagingPurgeButton = "Supprimer définitivement";
inline constexpr const char* MessagingReplyPrefix = "Re: ";
inline constexpr const char* MessagingUnknownUser = "Inconnu";
inline constexpr const char* MessagingNoSubject = "Sans sujet";
inline constexpr const char* MessagingLabelSubject = "Sujet : ";
inline constexpr const char* MessagingLabelFrom = "De : ";
inline constexpr const char* MessagingLabelTo = "À : ";
inline constexpr const char* MessagingLabelDate = "Date : ";
inline constexpr const char* MessagingLabelContent = "\n\nContenu :\n";
inline constexpr const char* MessagingSubjectSeparator = " - ";
inline constexpr const char* SocialOnlyOwnProfileEditable = "Seul votre profil peut être modifié.";
inline constexpr const char* SocialFrameTitle = "Social - %s";
inline constexpr const char* SocialFrameHeader = "Social";
inline constexpr const char* SocialSocialHeader = "Réseau social";
inline constexpr const char* SocialSocialSubtitle = "Messagerie, amis, demandes et profil.";
inline constexpr const char* SocialSocialStateAccessible = "État social";
inline constexpr const char* SocialNavigationMenuAccessible = "Menu de navigation";
inline constexpr const char* SocialMenuMessaging = "Messagerie";
inline constexpr const char* SocialMenuFriends = "Amis";
inline constexpr const char* SocialMenuIncomingRequests = "Demandes reçues";
inline constexpr const char* SocialMenuOutgoingRequests = "Demandes envoyées";
inline constexpr const char* SocialMenuBlocked = "Bloqués";
inline constexpr const char* SocialMenuProfile = "Mon profil";
inline constexpr const char* SocialSectionFriends = "Liste d'amis";
inline constexpr const char* SocialNoFriend = "Aucun ami.";
inline constexpr const char* SocialNoIncomingRequest = "Aucune demande reçue.";
inline constexpr const char* SocialNoOutgoingRequest = "Aucune demande envoyée.";
inline constexpr const char* SocialBlockedUsersTitle = "Utilisateurs bloqués";
inline constexpr const char* SocialNoBlockedUser = "Aucun utilisateur bloqué.";
inline constexpr const char* SocialProfileTitle = "Profil";
inline constexpr const char* SocialProfileDetails = "Détails du profil";
inline constexpr const char* SocialProfileEditBio = "Modifier la bio";
inline constexpr const char* SocialProfileEditVictory = "Modifier le message de victoire";
inline constexpr const char* SocialProfileEditDefeat = "Modifier le message de défaite";
inline constexpr const char* SocialProfileEditVisibility = "Modifier la visibilité";
inline constexpr const char* SocialProfileBioLabel = "Bio";
inline constexpr const char* SocialProfileVictoryLabel = "Message de victoire";
inline constexpr const char* SocialProfileDefeatLabel = "Message de défaite";
inline constexpr const char* SocialProfileVisibilityLabel = "Visibilité du profil";
inline constexpr const char* SocialProfileVisibilityChoicePublic = "Public";
inline constexpr const char* SocialProfileVisibilityChoiceFriends = "Amis";
inline constexpr const char* SocialProfileVisibilityChoicePrivate = "Privé";
inline constexpr const char* SocialProfileSave = "Enregistrer";
inline constexpr const char* SocialProfileSaveBio = "Enregistrer la bio";
inline constexpr const char* SocialProfileSaveMessage = "Enregistrer le message";
inline constexpr const char* SocialProfileSaveVisibility = "Enregistrer la visibilité";
inline constexpr const char* SocialProfileCancel = "Annuler";
inline constexpr const char* SocialProfileActionMenuList = "Actions sur les amis";
inline constexpr const char* SocialProfileActionIncomingList = "Actions sur les demandes reçues";
inline constexpr const char* SocialProfileActionOutgoingList = "Actions sur les demandes envoyées";
inline constexpr const char* SocialProfileActionBlockedList = "Actions sur les utilisateurs bloqués";
inline constexpr const char* SocialProfileActionView = "Voir le profil";
inline constexpr const char* SocialProfileActionRemoveFriend = "Retirer de ma liste d'amis";
inline constexpr const char* SocialProfileActionBlock = "Bloquer";
inline constexpr const char* SocialProfileActionUnblock = "Débloquer";
inline constexpr const char* SocialProfileActionAccept = "Accepter";
inline constexpr const char* SocialProfileActionReject = "Refuser";
inline constexpr const char* SocialProfileActionCancel = "Annuler";
inline constexpr const char* SocialProfileUnknownUser = "Utilisateur inconnu";
inline constexpr const char* SocialProfileBlockedSuffix = " - bloqué";
inline constexpr const char* SocialProfileAt = " - ";
inline constexpr const char* SocialProfileVisibilityPrefix = "Visibilité : ";
inline constexpr const char* SocialProfileCreatedAt = "Créé : ";
inline constexpr const char* SocialProfileUpdatedAt = "Mis à jour : ";
inline constexpr const char* SocialProfileBioText = "Bio : ";
inline constexpr const char* SocialProfileVictoryText = "Message de victoire : ";
inline constexpr const char* SocialProfileDefeatText = "Message de défaite : ";
inline constexpr const char* SocialProfilePrivateText = "Ce profil est privé.";
inline constexpr const char* SocialProfileEmptyText = "(vide)";
inline constexpr const char* SocialProfileVisibilityFriends = "Amis";
inline constexpr const char* SocialProfileVisibilityPrivate = "Privé";
inline constexpr const char* SocialProfileVisibilityPublic = "Public";
inline constexpr const char* SocialSelectPlayerToAct = "Sélectionnez un joueur.";
inline constexpr const char* SocialProfileLoaded = "Profil chargé.";
inline constexpr const char* SocialProfileUnavailable = "Profil indisponible.";
inline constexpr const char* SocialProfilePrivate = "Profil privé.";
inline constexpr const char* SocialProfileUpdated = "Profil mis à jour.";
inline constexpr const char* SocialProfileLoading = "Chargement du profil...";
inline constexpr const char* SocialLoadFriendsBusy = "Chargement des amis...";
inline constexpr const char* SocialLoadIncomingRequestsBusy = "Chargement des demandes reçues...";
inline constexpr const char* SocialLoadOutgoingRequestsBusy = "Chargement des demandes envoyées...";
inline constexpr const char* SocialLoadBlockedUsersBusy = "Chargement des utilisateurs bloqués...";
inline constexpr const char* SocialSaveProfileBusy = "Enregistrement du profil...";
inline constexpr const char* SocialSectionResultsEmpty = "0 résultats chargés.";
inline constexpr const char* SocialSectionResultsCount = "%zu résultats chargés.";
inline constexpr const char* SocialFriendRemoved = "Cet ami a été retiré de votre liste.";
inline constexpr const char* SocialProfileAccepted = "Demande acceptée.";
inline constexpr const char* SocialProfileRejected = "Demande refusée.";
inline constexpr const char* SocialProfileCanceled = "Demande annulée.";
inline constexpr const char* SocialProfileActionBlocked = "Blocage de l'utilisateur...";
inline constexpr const char* SocialProfileActionUnblocked = "Déblocage de l'utilisateur...";
inline constexpr const char* SocialProfileBlocked = "Utilisateur bloqué.";
inline constexpr const char* SocialProfileUnblocked = "Utilisateur débloqué.";
inline constexpr const char* SocialProfileRemoveBusy = "Retrait de l'ami...";
inline constexpr const char* SocialProfileAcceptBusy = "Acceptation de la demande...";
inline constexpr const char* SocialProfileRejectBusy = "Refus de la demande...";
inline constexpr const char* SocialProfileCancelBusy = "Annulation de la demande...";
inline constexpr const char* MessagingSearchBusy = "Chargement...";
inline constexpr const char* VerticalMenuIndexOutOfRange = "Indice d'élément de menu invalide.";
inline constexpr const char* MessagingLoadResultsEmpty = "0 résultats chargés.";
inline constexpr const char* MessagingLoadResultsCount = "%zu résultats chargés.";
inline constexpr const char* MessagingLoadMessagesBusy = "Chargement des messages...";
inline constexpr const char* MessagingDeleteConfirm = "Voulez-vous vraiment supprimer ce message ?";
inline constexpr const char* MessagingRestoreConfirm = "Voulez-vous vraiment restaurer ce message ?";
inline constexpr const char* MessagingPurgeConfirm = "Cette action supprime définitivement le message. Continuer ?";
inline constexpr const char* MessagingDeletedMessage = "Message supprimé.";
inline constexpr const char* MessagingRestoredMessage = "Message restauré.";
inline constexpr const char* MessagingPurgedMessage = "Message supprimé définitivement.";
inline constexpr const char* MessagingSentToUser = "Message envoyé à %s.";
inline constexpr const char* MessagingSentMessage = "Message envoyé.";
inline constexpr const char* MessagingNoMessage = "Aucun message.";
inline constexpr const char* MessagingMarkReadBusy = "Marquage du message comme lu...";
}







