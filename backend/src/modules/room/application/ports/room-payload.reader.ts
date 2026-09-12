import type { RoomPayloadRecord } from '../read-models/room-payload.record';

export const ROOM_PAYLOAD_READER = Symbol('ROOM_PAYLOAD_READER');

export interface RoomPayloadReader {
  findPayload(roomId: number): Promise<RoomPayloadRecord | null>;
}
