import { RoomPayload } from '../models/room-payload.model';

export const ROOM_GAME_PORT = Symbol('ROOM_GAME_PORT');

export interface RoomGamePort {
  authorizeGameAccess(
    roomId: number,
    userId: number,
    mode: 'read' | 'write',
  ): Promise<void>;
  getRoomPayload(roomId: number): Promise<RoomPayload>;
  refreshRoomPayload(roomId: number): Promise<RoomPayload>;
  resetRoom(roomId: number, userId: number): Promise<void>;
  startRoom(roomId: number, userId: number): Promise<void>;
  resetRoomSystem(roomId: number): Promise<void>;
  startRoomSystem(roomId: number): Promise<void>;
  prepareNextRun(roomId: number): Promise<void>;
  notifyRoomStateUpdated(roomId: number): Promise<void>;
  findLatestActiveRoomForUser(
    userId: number,
  ): Promise<{ roomId: number; gameType: string } | null>;
}
