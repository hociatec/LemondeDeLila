export type PrimalisFace =
  'herbivore' | 'carnivore' | 'egg' | 'leaf' | 'danger';

export interface PrimalisResources {
  herbivores: number;
  carnivores: number;
  eggs: number;
  leaves: number;
}

export type PrimalisState =
  import('../../../engine/sdk/public-api').NoGameState;
