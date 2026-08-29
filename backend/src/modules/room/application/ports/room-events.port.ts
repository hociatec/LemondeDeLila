export type RoomStateUpdatedListener = (roomId: number) => Promise<void> | void;
export type RoomDeletedListener = (roomId: number) => Promise<void> | void;
export type LobbyChangedListener = (
  roomId: number,
  reason: string,
) => Promise<void> | void;

export const ROOM_EVENTS_PORT = Symbol('ROOM_EVENTS_PORT');

export interface RoomEventsPort {
  onRoomStateUpdated(listener: RoomStateUpdatedListener): void;
  onRoomDeleted(listener: RoomDeletedListener): void;
  onLobbyChanged(listener: LobbyChangedListener): void;
}
