import type { GamePendingEvent } from '../models/game-event.model';
import type { GameState } from '../models/game-state.model';
import type { GameId, RoomId } from '../../../../shared/interfaces/public-api';

export const GAME_STATE_STORE = Symbol('GAME_STATE_STORE');

export type GameStateCommit = {
  roomId: RoomId;
  gameType: GameId;
  expectedVersion: number;
  expectedRestoreId?: string | null;
  next: GameState;
  pendingEvents: readonly GamePendingEvent[];
  occurredAtMs: number;
};

export type GameStateCommitResult = {
  committed: boolean;
  version: number;
  state: GameState;
};

export interface GameStateStore {
  load(roomId: RoomId, gameType: GameId): Promise<GameState | null>;
  restore(
    roomId: RoomId,
    gameType: GameId,
    state: GameState,
  ): Promise<GameState>;
  compareAndSet(commit: GameStateCommit): Promise<GameStateCommitResult>;
  clear(roomId: RoomId, gameType: GameId): Promise<void>;
  clearIfVersion(
    roomId: RoomId,
    gameType: GameId,
    expectedVersion: number,
  ): Promise<void>;
  clearRoom(roomId: RoomId): Promise<void>;
}
