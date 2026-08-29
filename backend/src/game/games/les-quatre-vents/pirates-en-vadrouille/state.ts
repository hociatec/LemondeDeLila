import type { GameEffectInstruction } from '../../../engine/sdk/public-api';

export type PirateTileType =
  'start' | 'neutral' | 'bonus' | 'treasure' | 'obstacle' | 'gold' | 'finish';

export interface PirateTile {
  n: number;
  title: string;
  description: string;
  type: PirateTileType;
}

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

export type PiratesState = Record<string, never>;
