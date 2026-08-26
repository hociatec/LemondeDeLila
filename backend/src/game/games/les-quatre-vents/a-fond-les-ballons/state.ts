import type { PlayerMap } from '../../../core/application/public-api';

export type AFondLesBallonsState = Record<string, never>;

export type AFondLesBallonsPlayerView = {
  trapImmunityTurns: PlayerMap<number>;
  swapPlayerId: number | null;
  pawnByPlayerId: PlayerMap<string>;
};
