import type { RoomPayload } from '../contracts/room-payload.model';

export const ROOM_PAYLOAD_CACHE = Symbol('ROOM_PAYLOAD_CACHE');

export interface RoomPayloadCachePort {
  prime(roomId: number, payload: RoomPayload): Promise<void>;
  invalidate(roomId: number): Promise<void>;
  update(
    roomId: number,
    updater: (payload: RoomPayload) => RoomPayload | null,
  ): Promise<RoomPayload | null>;
  get(roomId: number): Promise<RoomPayload | null>;
  persist(roomId: number, payload: RoomPayload): Promise<void>;
}
