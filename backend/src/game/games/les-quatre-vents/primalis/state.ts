import type { PlayerMap } from '../../../core/application/public-api';

export type PrimalisFace =
  'herbivore' | 'carnivore' | 'egg' | 'leaf' | 'danger';

export interface PrimalisResources {
  herbivores: number;
  carnivores: number;
  eggs: number;
  leaves: number;
}

export type PrimalisState = Record<string, never>;

export type PrimalisPlayerView = {
  dangerAmplified: boolean;
  collections: PlayerMap<PrimalisResources>;
  lastFace: PrimalisFace | null;
  positions: PlayerMap<number>;
  lastRoll: number | null;
};
