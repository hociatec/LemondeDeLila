import type { GameState } from './game-state.model';

export type EventVisibility<
  TPrivateData extends object = Record<string, unknown>,
> =
  | { kind: 'public' }
  | { kind: 'internal' }
  | { kind: 'private'; playerIds: readonly number[] }
  | {
      kind: 'split';
      privateDataByPlayer: Readonly<Record<string, Readonly<TPrivateData>>>;
    };

export type GamePendingEvent<
  TType extends string = string,
  TData extends object = Record<string, unknown>,
> = {
  actorId: number | null;
  type: TType;
  data: TData;
  visibility: EventVisibility;
  occurredAtMs: number;
};

export type GameEvent<
  TType extends string = string,
  TData extends object = Record<string, unknown>,
> = GamePendingEvent<TType, TData> & {
  /** Missing only on historical v1 events read from storage. */
  schemaVersion?: number;
  seq: number;
  version: number;
};

export type ProjectedGameEvent = Omit<
  GameEvent,
  'visibility' | 'schemaVersion'
> & {
  schemaVersion: number;
};
export type ProjectedGamePendingEvent = Omit<GamePendingEvent, 'visibility'>;

type GameStatePatchSetOperation<TState extends GameState> = {
  [TKey in keyof TState]-?: {
    operation: 'set';
    key: TKey;
    value: TState[TKey];
  };
}[keyof TState];

export type GameStatePatchOperation<TState extends GameState = GameState> =
  | GameStatePatchSetOperation<TState>
  | { operation: 'remove'; key: keyof TState };

export type GameSnapshot = {
  seq: number;
  version: number;
  state: GameState;
};

export type GameTimeline = {
  initial: GameSnapshot;
  events: GameEvent[];
  snapshots: GameSnapshot[];
};
/** Explicitly named data contract at the application boundary. */
