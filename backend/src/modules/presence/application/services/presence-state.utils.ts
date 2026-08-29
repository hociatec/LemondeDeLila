import { stringOrEmpty } from '@shared/utils/public-api';

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

export function parsePresenceRoomId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

export function scorePresenceActivity(
  activity: PresenceConnectionContext,
): number {
  if (activity === 'table') return 0;
  if (
    activity === 'messaging' ||
    activity === 'social' ||
    activity === 'notifications' ||
    activity === 'other'
  ) {
    return 1;
  }
  if (activity === 'chat') return 2;
  if (activity === 'tavern' || activity === 'stats') return 3;
  return 4;
}

export function normalizePresenceContext(
  raw: string,
): PresenceConnectionContext {
  if (raw === 'chat') return 'chat';
  if (raw === 'table') return 'table';
  if (raw === 'tavern') return 'tavern';
  if (raw === 'messaging') return 'messaging';
  if (raw === 'social') return 'social';
  if (raw === 'stats') return 'stats';
  if (raw === 'notifications') return 'notifications';
  if (raw === 'other') return 'other';
  return 'home';
}

export function decodePresenceCurrentRoom(
  value: unknown,
): { id: number; name: string } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const id = parsePresenceRoomId(record.id);
  if (id == null) {
    return null;
  }
  const name = stringOrEmpty(record.name).trim() || `Table #${id}`;
  return { id, name };
}

export function decodePresencePublicPlayer(
  value: unknown,
): PresenceDecodedPlayer | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const id =
    typeof record.id === 'number' && Number.isFinite(record.id)
      ? record.id
      : null;
  if (!id || id <= 0) {
    return null;
  }

  const rawActivity = (stringOrEmpty(record.activity) || 'home')
    .trim()
    .toLowerCase();
  const activity = normalizePresenceContext(rawActivity);
  const currentRoom = decodePresenceCurrentRoom(record.currentRoom);
  const lastInteractionAt =
    typeof record.lastInteractionAt === 'number' &&
    Number.isFinite(record.lastInteractionAt)
      ? record.lastInteractionAt
      : 0;
  const roomStarted =
    typeof record.roomStarted === 'boolean' ? record.roomStarted : null;

  return {
    id,
    username: stringOrEmpty(record.username).trim() || `user#${id}`,
    activity,
    currentRoom,
    lastInteractionAt,
    roomStarted,
  };
}

export function mergePresencePlayersFromOrigins(
  playersByOrigin: Map<string, { at: number; players: PresencePublicPlayer[] }>,
): PresencePublicPlayer[] {
  const combined: PresencePublicPlayer[] = [];
  for (const entry of playersByOrigin.values()) {
    combined.push(...(entry.players ?? []));
  }

  const byUser = new Map<number, PresencePublicPlayer>();
  for (const player of combined) {
    const candidate = decodePresencePublicPlayer(player);
    if (!candidate) continue;
    const existing = byUser.get(candidate.id);
    if (!existing) {
      byUser.set(candidate.id, candidate);
      continue;
    }

    const currentScore = scorePresenceActivity(existing.activity);
    const candidateScore = scorePresenceActivity(candidate.activity);
    if (candidateScore < currentScore) {
      byUser.set(candidate.id, candidate);
      continue;
    }

    if (candidateScore === currentScore) {
      if (!existing.currentRoom && candidate.currentRoom) {
        existing.currentRoom = candidate.currentRoom;
      }
      if (candidate.lastInteractionAt > (existing.lastInteractionAt ?? 0)) {
        existing.lastInteractionAt = candidate.lastInteractionAt;
      }
      if (existing.roomStarted == null && candidate.roomStarted != null) {
        existing.roomStarted = candidate.roomStarted;
      }
    }
  }

  return Array.from(byUser.values());
}

export function computePresenceAvailability(
  activity: PresenceConnectionContext,
  roomStarted: boolean | null,
  now: number,
  lastInteractionAt: number,
  absentAfterMs: number,
): PresenceAvailability {
  if (lastInteractionAt > 0 && now - lastInteractionAt >= absentAfterMs) {
    return 'absent';
  }
  if (activity === 'table') {
    return roomStarted ? 'occupied' : 'available';
  }
  if (
    activity === 'chat' ||
    activity === 'tavern' ||
    activity === 'stats' ||
    activity === 'home'
  ) {
    return 'available';
  }
  return 'occupied';
}

export function computePresenceLocation(
  activity: PresenceConnectionContext,
  currentRoom: { id: number; name: string } | null,
): string {
  if (activity === 'table') {
    return (
      currentRoom?.name ||
      (currentRoom?.id ? `Table #${currentRoom.id}` : 'Table')
    );
  }
  if (activity === 'chat') return 'tchat';
  if (activity === 'tavern') return 'taverne';
  if (activity === 'stats') return 'livre des contes';
  if (activity === 'messaging') return 'messagerie';
  if (activity === 'social') return 'social';
  if (activity === 'notifications') return 'notifications';
  if (activity === 'home') return 'accueil';
  return 'application';
}

export function enrichPresencePlayers(
  players: PresencePublicPlayer[],
  now: number,
  absentAfterMs: number,
): PresencePublicPlayer[] {
  return players.map((player) => {
    const last =
      typeof player.lastInteractionAt === 'number'
        ? player.lastInteractionAt
        : 0;
    const availability = computePresenceAvailability(
      player.activity,
      player.roomStarted,
      now,
      last,
      absentAfterMs,
    );
    const location = computePresenceLocation(
      player.activity,
      player.currentRoom,
    );
    return { ...player, availability, location };
  });
}
