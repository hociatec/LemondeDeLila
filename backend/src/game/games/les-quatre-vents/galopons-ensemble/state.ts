import type { PlayerMap } from '../../../core/application/public-api';

export type GaloponsTargetKind = 'give-apple' | 'help-advance' | 'pair-advance';

export type GaloponsState = Record<string, never>;

export type GaloponsPlayerView = {
  ious: PlayerMap<PlayerMap<number>>;
  apples: PlayerMap<number>;
  targetKind: GaloponsTargetKind | null;
  targetActorId: number | null;
  pawnByPlayerId: PlayerMap<string>;
  replay: boolean;
};
