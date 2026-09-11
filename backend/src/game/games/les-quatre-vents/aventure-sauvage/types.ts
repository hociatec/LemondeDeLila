import type { GameEffectInstruction } from '../../../engine/sdk/public-api';

export type AventureTileType = 'neutral' | 'animal' | 'patte' | 'finish';

export interface AventureCard {
  id: number;
  deck: 'animal' | 'patte';
  text: string;
  effects: readonly GameEffectInstruction[];
}

export type AventureSauvageState =
  import('../../../engine/sdk/public-api').NoGameState;
