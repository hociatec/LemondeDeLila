import type { CatPattesBotType, CatPattesObstacleType } from './content';

export interface CatPattesState {
  ownerPlayerId: number;
  configComplete: boolean;
  roundsToPlay: number;
  completedRounds: number;
  positions: Record<number, number>;
  points: Record<number, number>;
  obstacles: Record<number, CatPattesObstacleType | null>;
  powers: Record<number, CatPattesBotType[]>;
  turboPlayed: Record<number, number>;
  hasSun: Record<number, boolean>;
  sunReady: Record<number, boolean>;
  obstacleLock: Record<number, boolean>;
  drawnPlayerId: number | null;
  winnerId: number | null;
}

export type CatPattesPlayerView = CatPattesState & {
  hand: string[];
  handCounts: Record<number, number>;
  deckCount: number;
  discardCount: number;
};
