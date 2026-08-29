export type ParadeCandyType = 'Chamallow' | 'Chocobon' | 'Balisto';
export type CandyCounts = Record<ParadeCandyType, number>;

export type LaParadeSucreeState =
  import('../../../engine/sdk/public-api').NoGameState;
