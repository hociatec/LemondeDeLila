import type {
  GameEffectInstruction,
  PlayerMap,
} from '../../../core/application/public-api';

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

export interface PirateCollection {
  treasures: PirateCard[];
  obstacles: PirateCard[];
  bonus: PirateCard[];
  goldPieces: number;
}

export interface PirateCollectionState {
  treasureIds: number[];
  obstacleIds: number[];
  bonusIds: number[];
}

export type PiratesState = Record<string, never>;

export type PiratesPlayerView = {
  obstacleImmunity: PlayerMap<number>;
  collections: PlayerMap<PirateCollection>;
};
