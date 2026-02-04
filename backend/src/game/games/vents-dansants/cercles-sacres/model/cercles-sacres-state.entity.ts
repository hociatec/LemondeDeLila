import type { CerclesSacresTheme } from './cercles-sacres-cards';

export interface CerclesSacresCircle {
  id: string;
  cards: string[];
  themes: Record<CerclesSacresTheme, string>;
}

export interface CerclesSacresMetadata {
  rng?: Record<string, any>;
  deck: string[];
  discard: string[];
  hands: Record<number, string[]>;
  circles: Record<number, CerclesSacresCircle[]>;
  drawnPlayerId?: number | null;
  winnerId?: number | null;
}

export const CERCLES_SACRES_GOAL = 3;
export const CERCLES_SACRES_HAND_MIN = 6;
export const CERCLES_SACRES_HAND_LIMIT = 8;
