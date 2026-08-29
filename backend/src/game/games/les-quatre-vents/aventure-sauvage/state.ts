import type { GameEffectInstruction } from '../../../engine/sdk/public-api';

export type AventureTileType = 'neutral' | 'animal' | 'patte' | 'finish';

export interface AventureTile {
  type: AventureTileType;
  label: string;
}

export interface AventurePawn {
  id: string;
  label: string;
  description: string;
}

export interface AventureCard {
  id: number;
  deck: 'animal' | 'patte';
  text: string;
  effects: readonly GameEffectInstruction[];
}

export type AventureSauvageState = Record<string, never>;
