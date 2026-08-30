import type { RoomPlayer } from '../../contracts/room-payload.model';

type ParticipantLike = {
  leftAt?: Date | null;
  role?: string | null;
  user?: { id?: number | null; username?: string | null } | null;
};

const PLAYER_ROLES = new Set(['owner', 'player', 'participant']);

export function buildUniqueActiveRoomPlayers(
  participants: readonly ParticipantLike[] | null | undefined,
): RoomPlayer[] {
  const players = new Map<number, RoomPlayer>();
  for (const participant of participants ?? []) {
    if (participant?.leftAt) continue;
    const role = String(participant?.role ?? 'player')
      .trim()
      .toLowerCase();
    if (!PLAYER_ROLES.has(role)) continue;
    const id = Number(participant?.user?.id ?? 0);
    const username = String(participant?.user?.username ?? '').trim();
    if (!Number.isFinite(id) || id <= 0 || !username || players.has(id))
      continue;
    players.set(id, { id, username });
  }
  return Array.from(players.values());
}
/** Room application capability boundary. */
