export type GameRoomPayload = {
  room: {
    id: number;
    isPrivate: boolean;
    status: string;
    gameType: string;
    startedAt?: Date | string | null;
    runId?: number | null;
    owner: { id: number } | null;
    players: Array<{ id: number; username: string }>;
    bots: Array<{ id: number; name: string }>;
  };
};

export const GAME_ROOM_CONTEXT_PORT = Symbol('GAME_ROOM_CONTEXT_PORT');

export interface GameRoomContextPort {
  getRoomPayload(roomId: number): Promise<GameRoomPayload>;
  resetRoom(roomId: number, userId: number): Promise<void>;
  startRoom(roomId: number, userId: number): Promise<void>;
}

export type GameRoomDeletedListener = (roomId: number) => Promise<void> | void;
export type GameLobbyChangedListener = (
  roomId: number,
  reason: string,
) => Promise<void> | void;

export const GAME_ROOM_EVENTS_PORT = Symbol('GAME_ROOM_EVENTS_PORT');

export interface GameRoomEventsPort {
  onRoomDeleted(listener: GameRoomDeletedListener): void;
  onLobbyChanged(listener: GameLobbyChangedListener): void;
}
