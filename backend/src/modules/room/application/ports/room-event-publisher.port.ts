export interface RoomEventPublisherPort {
  publishRoomStateUpdated(roomId: number): Promise<void>;
  publishRoomDeleted(roomId: number): Promise<void>;
  publishLobbyChanged(roomId: number, reason: string): Promise<void>;
}

export const ROOM_EVENT_PUBLISHER = Symbol('ROOM_EVENT_PUBLISHER');
