import type { PlayerMap } from '../../../core/application/public-api';

export type ParadeCandyType = 'Chamallow' | 'Chocobon' | 'Balisto';
export type CandyCounts = Record<ParadeCandyType, number>;

export type LaParadeSucreeState = Record<string, never>;

export type LaParadeSucreePlayerView = {
  candies: PlayerMap<CandyCounts>;
  sequenceIndex: number;
  played: string[];
  nextCard: string | null;
};
