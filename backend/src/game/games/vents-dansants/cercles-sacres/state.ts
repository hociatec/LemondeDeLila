import type { CerclesSacresTheme } from './content';

export interface CerclesSacresCircle {
  id: string;
  cards: string[];
  themes: Record<CerclesSacresTheme, string>;
}

export interface CerclesSacresState {
  circles: Record<number, CerclesSacresCircle[]>;
  drawnPlayerId: number | null;
  winnerId: number | null;
}

export type CerclesSacresPlayerView = CerclesSacresState & {
  hand: string[];
  handCounts: Record<number, number>;
  deckCount: number;
  discardCount: number;
};
