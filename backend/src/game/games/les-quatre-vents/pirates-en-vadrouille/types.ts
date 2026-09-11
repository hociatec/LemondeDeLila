import type { GameEffectInstruction } from '../../../engine/sdk/public-api';

export type PirateTileType =
  'start' | 'neutral' | 'bonus' | 'treasure' | 'obstacle' | 'gold' | 'finish';

export interface PirateCard {
  id: number;
  title: string;
  description: string;
  effects: readonly GameEffectInstruction[];
}

export interface PirateCollectionState {
  treasureIds: number[];
  obstacleIds: number[];
  bonusIds: number[];
}

export type PiratesState = import('../../../engine/sdk/public-api').NoGameState;
