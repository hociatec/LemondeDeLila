export const MAX_PRESENCE_PLAYERS_PER_ORIGIN = 1_000;

export type PresenceConnectionContext =
  | 'home'
  | 'chat'
  | 'table'
  | 'tavern'
  | 'messaging'
  | 'social'
  | 'stats'
  | 'notifications'
  | 'other';

export type PresenceAvailability = 'available' | 'occupied' | 'absent';

export type PresenceBroadcastPlayer = {
  id: number;
  username: string;
  currentRoom: { id: number; name: string } | null;
  activity: PresenceConnectionContext;
  contextLocked: boolean;
  lastInteractionAt: number;
  roomStarted: boolean | null;
};

export type PresencePublicPlayer = Omit<
  PresenceBroadcastPlayer,
  'contextLocked'
> & {
  availability?: PresenceAvailability;
  location?: string;
};

export type PresenceDecodedPlayer = {
  id: number;
  username: string;
  activity: PresenceConnectionContext;
  currentRoom: { id: number; name: string } | null;
  lastInteractionAt: number;
  roomStarted: boolean | null;
};
