#pragma once

namespace lila::shared::text::ui
{
// Keyboard Navigation
inline constexpr const char* KeyboardNavigationHint = "Flèches haut/bas : naviguer. Entrée : sélectionner. Échap : revenir.";

// Chat UI Texts
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
inline constexpr const char* ChatEditMode = "Édition du message.";
inline constexpr const char* ChatEditAborted = "Édition annulée.";
inline constexpr const char* ChatEditHint = "Saisissez votre message puis appuyez sur Entrée.";
inline constexpr const char* ChatDeleteConfirm = "Supprimer ce message ?";
inline constexpr const char* ChatCloseConfirmation = "Fermer le tchat ?";

// Messaging UI Texts
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
inline constexpr const char* MessagingDeleteConfirm = "Voulez-vous vraiment supprimer ce message ?";
inline constexpr const char* MessagingRestoreConfirm = "Voulez-vous vraiment restaurer ce message ?";
inline constexpr const char* MessagingPurgeConfirm = "Cette action supprime définitivement le message. Continuer ?";

// Social UI Texts
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
}
