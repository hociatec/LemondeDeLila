import { RoomPayload } from '../contracts/room-payload.model';

export const ROOM_VAULT_PORT = Symbol('ROOM_VAULT_PORT');

export type RoomVaultRoomRecord = {
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

export interface RoomVaultPort {
  getRoomPayload(roomId: number): Promise<RoomPayload>;
  requireRoomForOwnerAction(
    roomId: number,
    userId: number,
  ): Promise<RoomVaultRoomRecord>;
  adminDestroyRoom(roomId: number): Promise<{ ok: true; roomId: number }>;
  findLatestActiveRoomForUser(
    userId: number,
  ): Promise<{ roomId: number; gameType: string } | null>;
  createRoom(
    userId: number,
    gameType: string,
    name?: string | null,
    maxPlayers?: number | null,
    isPrivate?: boolean,
    invalidateCache?: boolean,
  ): Promise<RoomVaultRoomRecord>;
  saveRoom(room: RoomVaultRoomRecord): Promise<RoomVaultRoomRecord>;
  joinRoom(
    roomId: number,
    userId: number,
    opts?: { allowPrivate?: boolean },
  ): Promise<RoomVaultRoomRecord>;
  invalidateRoomPayloadCache(roomId: number): Promise<void>;
  startRoom(
    roomId: number,
    userId: number,
    invalidateCache?: boolean,
  ): Promise<RoomVaultRoomRecord>;
  notifyRoomStateUpdated(roomId: number): Promise<void>;
}
