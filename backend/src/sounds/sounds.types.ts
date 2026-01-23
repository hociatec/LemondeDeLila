export const SOUND_KEYS = [
  'ClientOpened',
  'ClientConnected',
  'ClientDisconnected',
  'ClientClosing',
  'ClientUpdateWarning',
  'MainMenuMusic',
  'TavernAmbience',
  'TavernOpened',
  'DiceRolled',
  'ChatMessageSent',
  'ChatMessageReceived',
  'TableChatMessageSent',
  'TableChatMessageReceived',
  'PrivateMessageSent',
  'PrivateMessageReceived',
  'AdminContactSent',
  'AdminContactReceived',
  'BugReportCommentReceived',
  'FriendConnected',
  'FriendDisconnected',
  'FriendInvitationSent',
  'FriendInvitationReceived',
  'GameVictory',
  'GameDefeat',
  'QuizCorrect',
  'QuizWrong',
  'RoundEnded',
  'InvitationSent',
  'InvitationReceived',
  'RoomOpened',
  'RoomJoined',
  'RoomExit',
  'PawnPicked',
  'PawnPlacedSelf',
  'PawnPlacedOpponent',
  'WallPlacedSelf',
  'WallPlacedOpponent',
  'TableAmbience1',
  'TableAmbience2',
  'TableAmbience3',
  'TableAmbience4',
  'TableAmbience5',
  'TableAmbience6',
  'TableAmbience7',
  'TableAmbience8',
  'TableAmbience9',
  'TableAmbience10',
  'TableAmbience11',
  'TableAmbience12',
  'TableAmbience13',
  'TableAmbience14',
  'TableAmbience15',
  'TableAmbience16',
  'TableAmbience17',
  'TableAmbience18',
  'TableAmbience19',
  'TableAmbience20',
] as const;

export type SoundKey = (typeof SOUND_KEYS)[number];

export type SoundManifestEntry = {
  soundId: SoundKey;
  sha256: string;
  bytes: number;
  uploadedAt: string; // ISO
  url: string; // absolute-ish path for clients (relative to host)
};

export type SoundManifest = {
  updatedAt: string; // ISO
  sounds: Partial<Record<SoundKey, SoundManifestEntry>>;
};
