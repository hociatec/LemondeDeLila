import type { GameEffectInstruction } from '../../../engine/sdk/public-api';

export type MamanTileType =
  | 'start'
  | 'neutral'
  | 'token'
  | 'card'
  | 'bonds'
  | 'slide'
  | 'storm'
  | 'nest'
  | 'meeting'
  | 'finish';

export interface MamanTile {
  id: number;
  title: string;
  type: MamanTileType;
  description?: string;
}

export interface MamanCard {
  id: number;
  text: string;
  effects: readonly GameEffectInstruction[];
}

export type ToutPresDeMamanState = Record<string, never>;
