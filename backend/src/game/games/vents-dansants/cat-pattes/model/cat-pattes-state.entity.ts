import type {
  CatPattesBotType,
  CatPattesObstacleType,
} from './cat-pattes-cards';
import type { CatPattesPawn } from './cat-pattes-cards';

export interface CatPattesMetadata {
  rng?: Record<string, any>;
  deck: string[];
  discard: string[];
  hands: Record<number, string[]>;
  positions: Record<number, number>;
  points: Record<number, number>;
  obstacles: Record<number, CatPattesObstacleType | null>;
  bots: Record<number, CatPattesBotType[]>;
  turboPlayed: Record<number, number>;
  hasSun: Record<number, boolean>;
  pawns: CatPattesPawn[];
  pawnByPlayerId: Record<number, string>;
  setupStep?: 'setup_config' | 'choose_pawn' | 'playing';
  ownerPlayerId?: number | null;
  goalPattes?: number;
  pointsToWin?: number;
  setupStarterId?: number | null;
  drawnPlayerId?: number | null;
  winnerId?: number | null;
}

export const CAT_PATTES_GOAL = 1000;
export const CAT_PATTES_POINTS_TO_WIN = 5000;
