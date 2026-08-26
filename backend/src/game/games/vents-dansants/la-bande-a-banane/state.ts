import type { BandeABananeMonkeySpecies } from './content';

export interface BandeABananeTroopEntry {
  cardId: string;
  species: BandeABananeMonkeySpecies;
  isJoker: boolean;
}

export interface BandeABananeState {
  troops: Record<number, BandeABananeTroopEntry[]>;
  skipTurns: Record<number, number>;
  drawnPlayerId: number | null;
  winnerId: number | null;
}

export type BandeABananePlayerView = BandeABananeState & {
  hand: string[];
  handCounts: Record<number, number>;
  deckCount: number;
  discardCount: number;
};
