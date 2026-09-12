import type {
  GameId,
  RoomId,
  UserId,
} from '../../../../shared/interfaces/public-api';

export type GameRoomPayload = {
  room: {
    id: RoomId;
    isPrivate: boolean;
    status: string;
    gameType: GameId;
    startedAt?: Date | string | null;
    runId?: number | null;
    owner: { id: UserId } | null;
    players: Array<{ id: UserId; username: string }>;
    bots: Array<{ id: number; name: string }>;
  };
};

export const GAME_ROOM_CONTEXT_PORT = Symbol('GAME_ROOM_CONTEXT_PORT');

export interface GameRoomContextPort {
  authorizeGameAccess(
    roomId: RoomId,
    userId: UserId,
    mode: 'read' | 'write',
  ): Promise<void>;
  getRoomPayload(roomId: RoomId): Promise<GameRoomPayload>;
  refreshRoomPayload(roomId: RoomId): Promise<GameRoomPayload>;
  resetRoom(roomId: RoomId, userId: UserId): Promise<void>;
  startRoom(roomId: RoomId, userId: UserId): Promise<void>;
  prepareNextRun(roomId: RoomId): Promise<void>;
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
