import type { RoomRecord } from '../contracts/room-record.model';
import type { RoomUserRecord } from '../contracts/room-user.model';

export const ROOM_REPOSITORY = Symbol('ROOM_REPOSITORY');

export type ListRoomsFilters = {
  includePrivate: boolean;
  includeStarted: boolean;
  limit: number;
};

export type CleanupRoomsFilters = {
  includePrivate: boolean;
  includeStarted: boolean;
  olderThanMinutes: number | null;
  limit: number;
};

export interface RoomRepository {
  create(data: Partial<RoomRecord>): RoomRecord;
  save(room: RoomRecord): Promise<RoomRecord>;
  update(id: number, patch: Partial<RoomRecord>): Promise<void>;
  delete(ids: number | number[]): Promise<void>;
  exists(id: number): Promise<boolean>;
  findById(id: number): Promise<RoomRecord | null>;
  findByIdWithOwner(id: number): Promise<RoomRecord | null>;
  findByIdWithPayloadRelations(id: number): Promise<RoomRecord | null>;
  listForAdmin(filters: ListRoomsFilters): Promise<RoomRecord[]>;
  listCleanupCandidateIds(filters: CleanupRoomsFilters): Promise<number[]>;
  createOwnedRoom(input: {
    name: string;
    gameType: string;
    maxPlayers: number;
    isPrivate: boolean;
    status: string;
    owner: RoomUserRecord;
    createdAt: Date;
  }): Promise<RoomRecord>;
}
