export type PrimalisFace =
  | 'herbivore'
  | 'carnivore'
  | 'egg'
  | 'leaf'
  | 'danger';

export interface PrimalisResources {
  herbivores: number;
  carnivores: number;
  eggs: number;
  leaves: number;
}

export interface PrimalisState {
  collections: Record<number, PrimalisResources>;
  dangerAmplified: boolean;
  lastRoll: number | null;
  lastFace: PrimalisFace | null;
}

export type PrimalisPlayerView = PrimalisState & {
  positions: Record<number, number>;
};
