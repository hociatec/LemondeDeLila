export const SOUND_KEYS = [
  'ClientOpened',
  'ClientConnected',
  'ClientDisconnected',
  'MainMenuMusic',
  'TavernAmbience',
  'ChatMessageSent',
  'ChatMessageReceived',
  'PrivateMessageSent',
  'PrivateMessageReceived',
  'FriendConnected',
  'FriendDisconnected',
  'FriendInvitationSent',
  'FriendInvitationReceived',
  'GameVictory',
  'GameDefeat',
  'InvitationSent',
  'InvitationReceived',
  'RoomOpened',
  'RoomJoined',
  'RoomExit',
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
