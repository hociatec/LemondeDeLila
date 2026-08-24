import type { BandeABananeMonkeySpecies } from './la-bande-a-banane-cards';

export interface BandeABananeTroopEntry {
  cardId: string;
  species: BandeABananeMonkeySpecies;
  isJoker?: boolean;
}

export interface BandeABananeMetadata {
  rng?: Record<string, unknown>;
  deck: string[];
  discard: string[];
  hands: Record<number, string[]>;
  troops: Record<number, BandeABananeTroopEntry[]>;
  statuses: {
    skipTurn: Record<number, number>;
  };
  drawnPlayerId?: number | null;
  winnerId?: number | null;
}
