import type { RoomPayload } from '../dto/room-response.dto';

export function requireValidRoomId(roomId: number): number {
  if (!Number.isFinite(roomId) || roomId <= 0) {
    throw new Error('roomId invalide');
  }

  return roomId;
}

export function requireTargetUserId(
  row: Record<string, unknown>,
  candidateKeys: readonly string[],
): number {
  const targetRaw = candidateKeys
    .map((key) => row[key])
    .find((value) => value !== undefined && value !== null);
  const targetUserId = Number(targetRaw);
  if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
    throw new Error('userId invalide');
  }

  return targetUserId;
}

export function ensureUserIsOnTable(
  state: RoomPayload | null | undefined,
  userId: number,
  spectatorIds: readonly number[],
  hasUserConnections: boolean,
): void {
  const isOnTable =
    (state?.room?.players?.some((player) => player?.id === userId) ?? false) ||
    spectatorIds.includes(userId) ||
    hasUserConnections;

  if (!isOnTable) {
    throw new Error('Utilisateur introuvable sur la table');
  }
}

export function requireOwnerActionState(
  state: RoomPayload,
  userId: number,
  ownerErrorMessage: string,
): RoomPayload {
  const ownerId = state?.room?.owner?.id ?? 0;
  if (ownerId !== userId) {
    throw new Error(ownerErrorMessage);
  }

  return state;
}
