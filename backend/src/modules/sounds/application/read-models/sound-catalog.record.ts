import type { SoundKey } from './sound-manifest.record';

export type SoundCatalogItem = {
  soundId: SoundKey;
  category: string;
  screen: string;
  event: string;
  loop: boolean;
};

const item = (
  soundId: SoundKey,
  category: string,
  screen: string,
  event: string,
  loop = false,
): SoundCatalogItem => ({ soundId, category, screen, event, loop });

export const SOUND_CATALOG: readonly SoundCatalogItem[] = [
  item('ClientOpened', 'Application', 'Application', 'Ouverture'),
  item('ClientConnected', 'Application', 'Connexion', 'Connexion réussie'),
  item('ClientDisconnected', 'Application', 'Connexion', 'Déconnexion'),
  item('ClientClosing', 'Application', 'Application', 'Fermeture'),
  item('ClientUpdateWarning', 'Application', 'Mise à jour', 'Avertissement'),
  item('MainMenuMusic', 'Application', 'Menu principal', 'Musique', true),
  item('TavernAmbience', 'Taverne', 'Taverne', 'Ambiance', true),
  item('TavernOpened', 'Taverne', 'Taverne', 'Entrée'),
  item('TavernClosed', 'Taverne', 'Taverne', 'Sortie'),
  item('RoomOpened', 'Table', 'Table', 'Création et entrée'),
  item('RoomJoined', 'Table', 'Table', 'Rejoindre'),
  item('RoomExit', 'Table', 'Table', 'Sortie'),
  item('RoomMemberJoined', 'Table', 'Participants', 'Un participant a rejoint'),
  item('RoomMemberLeft', 'Table', 'Participants', 'Un participant est parti'),
  item('TableStarted', 'Table', 'Partie', 'Démarrage'),
  item('InvitationSent', 'Table', 'Invitations', 'Invitation envoyée'),
  item('InvitationReceived', 'Table', 'Invitations', 'Invitation reçue'),
  item('DiceRolled', 'Jeu', 'Partie', 'Lancer de dé'),
  item('DrawCard', 'Jeu', 'Partie', 'Pioche'),
  item('PawnPicked', 'Jeu', 'Plateau', 'Pion sélectionné'),
  item('PawnPlacedSelf', 'Jeu', 'Plateau', 'Votre pion placé'),
  item('PawnPlacedOpponent', 'Jeu', 'Plateau', 'Pion adverse placé'),
  item('WallPlacedSelf', 'Jeu', 'Plateau', 'Votre mur placé'),
  item('WallPlacedOpponent', 'Jeu', 'Plateau', 'Mur adverse placé'),
  item('GameVictory', 'Jeu', 'Résultat', 'Victoire'),
  item('GameDefeat', 'Jeu', 'Résultat', 'Défaite'),
  item('QuizCorrect', 'Jeu', 'Quiz', 'Bonne réponse'),
  item('QuizWrong', 'Jeu', 'Quiz', 'Mauvaise réponse'),
  item('RoundEnded', 'Jeu', 'Partie', 'Fin de manche'),
  item('ChatMessageSent', 'Tchat', 'Tchat général', 'Message envoyé'),
  item('ChatMessageReceived', 'Tchat', 'Tchat général', 'Message reçu'),
  item('TableChatMessageSent', 'Tchat', 'Tchat de table', 'Message envoyé'),
  item('TableChatMessageReceived', 'Tchat', 'Tchat de table', 'Message reçu'),
  item('PrivateMessageSent', 'Tchat', 'Messages privés', 'Message envoyé'),
  item('PrivateMessageReceived', 'Tchat', 'Messages privés', 'Message reçu'),
  item('AdminContactSent', 'Tchat', 'Contact administration', 'Message envoyé'),
  item(
    'AdminContactReceived',
    'Tchat',
    'Contact administration',
    'Réponse reçue',
  ),
  item(
    'BugReportCommentReceived',
    'Tchat',
    'Rapports de bug',
    'Commentaire reçu',
  ),
  item('FriendConnected', 'Social', 'Amis', 'Connexion'),
  item('FriendDisconnected', 'Social', 'Amis', 'Déconnexion'),
  item('FriendInvitationSent', 'Social', 'Demandes d’ami', 'Demande envoyée'),
  item('FriendInvitationReceived', 'Social', 'Demandes d’ami', 'Demande reçue'),
  ...Array.from({ length: 20 }, (_, index) =>
    item(
      `TableAmbience${index + 1}` as SoundKey,
      'Ambiances',
      'Table',
      `Ambiance ${index + 1}`,
      true,
    ),
  ),
];
