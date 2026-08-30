import type { GameEvent, GameSnapshot } from '../contracts/game-event.model';
import type { GameStateEntity } from '../contracts/game-state.model';

export const GAME_EVENT_STORE = Symbol('GAME_EVENT_STORE');
export const GAME_SNAPSHOT_POLICY = Symbol('GAME_SNAPSHOT_POLICY');

export type GameSnapshotPolicy = {
  everyEvents?: number | null;
  maxEventBytes?: number | null;
  maxStateBytes?: number | null;
};

export const DEFAULT_GAME_SNAPSHOT_POLICY: Readonly<GameSnapshotPolicy> =
  Object.freeze({
    everyEvents: 25,
    maxEventBytes: 256_000,
    maxStateBytes: 1_000_000,
  });

export interface GameEventStore {
  listEvents(
    roomId: number,
    gameType: string,
    afterSequence?: number,
    limit?: number,
  ): Promise<GameEvent[]>;
  latestSnapshot(
    roomId: number,
    gameType: string,
  ): Promise<GameSnapshot | null>;
  replay(
    roomId: number,
    gameType: string,
    untilSequence?: number,
  ): Promise<GameStateEntity | null>;
}
