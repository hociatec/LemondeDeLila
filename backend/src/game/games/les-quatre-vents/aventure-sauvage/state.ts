import type {
  GameEffectInstruction,
  PlayerMap,
} from '../../../core/application/public-api';

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

export type AventureSauvagePlayerView = {
  pawnByPlayerId: PlayerMap<string>;
  lastRoll: number | null;
  positions: PlayerMap<number>;
  winnerId: number | null;
  skipTurns: PlayerMap<number>;
  setupComplete: boolean;
};
