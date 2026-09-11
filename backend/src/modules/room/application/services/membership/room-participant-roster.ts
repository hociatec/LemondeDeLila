import type { RoomPlayer } from '../../models/room-payload.model';
import { asUserId } from '../../../../../shared/interfaces/public-api';

type ParticipantLike = {
  leftAt?: Date | null;
  role?: string | null;
  user?: { id?: number | null; username?: string | null } | null;
};

const PLAYER_ROLES = new Set(['owner', 'player', 'participant']);
const MAX_USERNAME_LENGTH = 255;

export function buildUniqueActiveRoomPlayers(
  participants: readonly ParticipantLike[] | null | undefined,
): RoomPlayer[] {
  const players = new Map<number, RoomPlayer>();
  for (const participant of (participants ?? []).slice(0, 1_000)) {
    if (participant?.leftAt) continue;
    const role = String(participant?.role ?? 'player')
      .trim()
      .toLowerCase();
    if (!PLAYER_ROLES.has(role)) continue;
    const id = Number(participant?.user?.id ?? 0);
    const username = String(participant?.user?.username ?? '').trim();
    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      !username ||
      username.length > MAX_USERNAME_LENGTH ||
      players.has(id)
    )
      continue;
    if (players.size < 64) players.set(id, { id: asUserId(id), username });
  }
  return Array.from(players.values());
}
/** Room application capability boundary. */
