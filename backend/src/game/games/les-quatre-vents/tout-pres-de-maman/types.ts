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

export interface MamanCard {
  id: number;
  text: string;
  effects: readonly GameEffectInstruction[];
}

export type ToutPresDeMamanState =
  import('../../../engine/sdk/public-api').NoGameState;
