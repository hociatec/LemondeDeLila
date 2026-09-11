import type { PlayerState } from '../../../core/application/models/game-state.model';
import type { PlayerMap } from '../game-identifiers';

export interface ContextPlayersCapability {
  readonly actor: PlayerState | null;
  readonly players: {
    all: () => PlayerState[];
    byId: <TValue>(
      select: (player: PlayerState, index: number) => TValue,
    ) => PlayerMap<TValue>;
    active: () => PlayerState[];
    remaining: () => PlayerState[];
    get: (playerId: number) => PlayerState | null;
    other: (playerId: number, actorId?: number | null) => PlayerState | null;
    others: (playerId?: number | null) => PlayerState[];
    otherIds: (playerId?: number | null) => number[];
    count: () => number;
    current: () => PlayerState | null;
    next: () => PlayerState | null;
    previous: () => PlayerState | null;
    after: (playerId: number, offset?: number) => PlayerState | null;
    before: (playerId: number, offset?: number) => PlayerState | null;
    randomOther: (playerId?: number | null) => PlayerState | null;
  };
}
