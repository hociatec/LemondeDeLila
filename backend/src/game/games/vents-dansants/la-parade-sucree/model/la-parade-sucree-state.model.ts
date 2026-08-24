import type { ParadeCandyType } from './la-parade-sucree-cards';

export type CandyCounts = Record<ParadeCandyType, number>;

export interface LaParadeSucreeMetadata {
  rng?: Record<string, unknown>;
  hands: Record<number, string[]>;
  candies: Record<number, CandyCounts>;
  sequenceIndex: number;
  played: string[];
  winnerId?: number | null;
}
