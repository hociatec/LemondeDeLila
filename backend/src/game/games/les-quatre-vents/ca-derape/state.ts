import type { PlayerMap } from '../../../core/application/public-api';

export type CaPendingKind = 'swap' | 'next-player' | 'next-delta' | 'mirror';

export type CaDerapeState = Record<string, never>;

export type CaDerapePlayerView = {
  lastRollByPlayer: PlayerMap<number>;
  lastMoveDelta: PlayerMap<number>;
  turnsSinceMoved: PlayerMap<number>;
  mirrorNextRollFrom: PlayerMap<number | null>;
  nextPlayerDelta: number | null;
  pendingKind: CaPendingKind | null;
  pendingActorId: number | null;
  ignoreNextPenalty: PlayerMap<boolean>;
  doubleNextMove: PlayerMap<boolean>;
  doubleNextRoll: PlayerMap<boolean>;
};
