import type { GameStateEntity } from './game-state.model';

export type GamePendingEvent = {
  actorId: number | null;
  type: string;
  data: Record<string, unknown>;
  occurredAtMs: number;
};

export type GameEvent = GamePendingEvent & {
  seq: number;
  version: number;
};

export type GameStatePatchOperation =
  | { operation: 'set'; key: keyof GameStateEntity; value: unknown }
  | { operation: 'remove'; key: keyof GameStateEntity };

export type GameSnapshot = {
  seq: number;
  version: number;
  state: GameStateEntity;
};

export type GameTimeline = {
  initial: GameSnapshot;
  events: GameEvent[];
  snapshots: GameSnapshot[];
};
