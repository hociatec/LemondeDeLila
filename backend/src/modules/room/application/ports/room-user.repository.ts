import type { RoomUserRecord } from '../contracts/room-user.model';

export const ROOM_USER_REPOSITORY = Symbol('ROOM_USER_REPOSITORY');

export interface RoomUserRepository {
  findById(id: number): Promise<RoomUserRecord | null>;
}
