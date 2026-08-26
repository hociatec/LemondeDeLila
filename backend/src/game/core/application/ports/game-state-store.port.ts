import type { GamePendingEvent } from '../models/game-event.model';
import type { GameStateEntity } from '../models/game-state.model';

export const GAME_STATE_STORE = Symbol('GAME_STATE_STORE');

export type GameStateCommit = {
  roomId: number;
  gameType: string;
  expectedVersion: number;
  next: GameStateEntity;
  pendingEvents: readonly GamePendingEvent[];
  occurredAtMs: number;
};

export type GameStateCommitResult = {
  committed: boolean;
  version: number;
  state: GameStateEntity;
};

export interface GameStateStore {
  load(roomId: number, gameType: string): Promise<GameStateEntity | null>;
  restore(
    roomId: number,
    gameType: string,
    state: GameStateEntity,
  ): Promise<void>;
  compareAndSet(commit: GameStateCommit): Promise<GameStateCommitResult>;
  clear(roomId: number, gameType: string): Promise<void>;
  clearIfVersion(
    roomId: number,
    gameType: string,
    expectedVersion: number,
  ): Promise<void>;
  clearRoom(roomId: number): Promise<void>;
}
