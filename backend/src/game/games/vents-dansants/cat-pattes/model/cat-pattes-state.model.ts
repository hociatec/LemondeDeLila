import type {
  CatPattesBotType,
  CatPattesObstacleType,
} from './cat-pattes-cards';

export interface CatPattesMetadata {
  rng?: Record<string, unknown>;
  deck: string[];
  discard: string[];
  hands: Record<number, string[]>;
  positions: Record<number, number>;
  points: Record<number, number>;
  obstacles: Record<number, CatPattesObstacleType | null>;
  bots: Record<number, CatPattesBotType[]>;
  turboPlayed: Record<number, number>;
  hasSun: Record<number, boolean>;
  sunReady?: Record<number, boolean>;
  obstacleLock?: Record<number, boolean>;
  setupStep?: 'setup_config' | 'playing';
  ownerPlayerId?: number | null;
  goalPattes?: number;
  roundsToPlay?: number;
  completedRounds?: number;
  setupStarterId?: number | null;
  drawnPlayerId?: number | null;
  winnerId?: number | null;
}

export const CAT_PATTES_GOAL = 1000;
export const CAT_PATTES_DEFAULT_ROUNDS = 3;
