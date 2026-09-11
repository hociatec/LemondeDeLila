export interface RoomPresencePort {
  broadcastPresence(): void;
}

export const ROOM_PRESENCE_PORT = Symbol('ROOM_PRESENCE_PORT');
