import type { PlayerMap } from '../../../core/application/public-api';

export type GaloponsTargetKind = 'give-apple' | 'help-advance' | 'pair-advance';

export type GaloponsState = Record<string, never>;

export type GaloponsPlayerView = {
  ious: PlayerMap<PlayerMap<number>>;
  apples: PlayerMap<number>;
  movementDirection: PlayerMap<1 | -1>;
  targetKind: GaloponsTargetKind | null;
  targetActorId: number | null;
  pawnByPlayerId: PlayerMap<string>;
  starterId: number;
  replay: boolean;
  positions: PlayerMap<number>;
  winnerId: number | null;
  skipTurns: PlayerMap<number>;
  setupComplete: boolean;
};
