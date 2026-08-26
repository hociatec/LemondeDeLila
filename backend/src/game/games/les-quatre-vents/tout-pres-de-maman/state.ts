import type {
  GameEffectInstruction,
  PlayerMap,
} from '../../../core/application/public-api';

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

export type ToutPresDeMamanPlayerView = {
  tokens: PlayerMap<number>;
  bonusReroll: PlayerMap<boolean>;
  lastRoll: number | null;
  positions: PlayerMap<number>;
  winnerId: number | null;
  skipTurns: PlayerMap<number>;
};
