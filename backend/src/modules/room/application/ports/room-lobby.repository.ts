import type { RoomRecord } from '../contracts/room-record.model';

export const ROOM_LOBBY_REPOSITORY = Symbol('ROOM_LOBBY_REPOSITORY');

export interface RoomLobbyRepository {
  listPublicRooms(filters?: {
    gameType?: string | null;
  }): Promise<RoomRecord[]>;
  findRoomWithOwner(roomId: number): Promise<RoomRecord | null>;
  hasActiveParticipant(roomId: number, userId: number): Promise<boolean>;
  listActiveParticipantUserIds(roomId: number): Promise<number[]>;
}
