import type { GameEvent, GameSnapshot } from '../models/game-event.model';
import type { GameState } from '../models/game-state.model';
import type { GameId, RoomId } from '../../../../shared/interfaces/public-api';

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
    roomId: RoomId,
    gameType: GameId,
    afterSequence?: number,
    limit?: number,
  ): Promise<GameEvent[]>;
  latestSnapshot(
    roomId: RoomId,
    gameType: GameId,
  ): Promise<GameSnapshot | null>;
  replay(
    roomId: RoomId,
    gameType: GameId,
    untilSequence?: number,
  ): Promise<GameState | null>;
}
