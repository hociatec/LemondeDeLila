import type { VaultRoomSnapshotSource } from '../contracts/vault-room-snapshot-source';

export const VAULT_ROOM_PORT = Symbol('VAULT_ROOM_PORT');

/** Room creation needs owned by the restore use case. */
export type VaultRoomCreateInput = {
  userId: number;
  gameType: string;
  name?: string | null;
  maxPlayers?: number | null;
  isPrivate?: boolean;
  invalidateCache?: boolean;
};

export type VaultRoomRecord = {
  id: number;
  name: string;
  gameType: string;
  maxPlayers: number;
  isPrivate: boolean;
  status: string;
  ownerId: number | null;
  startedAt: Date | null;
  runId: number;
  tableAmbienceSoundId: string | null;
  restoredFromSnapshotId: string | null;
  restoredOwnerUserId: number | null;
};

export interface VaultRoomPort {
  getRoomPayload(roomId: number): Promise<VaultRoomSnapshotSource>;
  requireRoomForOwnerAction(
    roomId: number,
    userId: number,
  ): Promise<VaultRoomRecord>;
  adminDestroyRoom(roomId: number): Promise<{ ok: true; roomId: number }>;
  findLatestActiveRoomForUser(
    userId: number,
  ): Promise<{ roomId: number; gameType: string } | null>;
  createRoom(command: VaultRoomCreateInput): Promise<VaultRoomRecord>;
  saveRoom(room: VaultRoomRecord): Promise<VaultRoomRecord>;
  joinRoom(
    roomId: number,
    userId: number,
    opts?: { allowPrivate?: boolean },
  ): Promise<VaultRoomRecord>;
  invalidateRoomPayloadCache(roomId: number): Promise<void>;
  startRoom(
    roomId: number,
    userId: number,
    invalidateCache?: boolean,
  ): Promise<VaultRoomRecord>;
  notifyRoomStateUpdated(roomId: number): Promise<void>;
}
