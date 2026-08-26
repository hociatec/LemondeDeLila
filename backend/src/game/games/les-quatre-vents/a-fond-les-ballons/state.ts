import type { PlayerMap } from '../../../core/application/public-api';

export type AFondLesBallonsState = Record<string, never>;

export type AFondLesBallonsPlayerView = {
  trapImmunityTurns: PlayerMap<number>;
  swapPlayerId: number | null;
  pawnByPlayerId: PlayerMap<string>;
  starterId: number;
  lastRoll: number | null;
  extraTurn: boolean;
  positions: PlayerMap<number>;
  winnerId: number | null;
  skipTurns: PlayerMap<number>;
  setupComplete: boolean;
};
