import type { BandeABananeMonkeySpecies } from './content';

export interface BandeABananeTroopEntry {
  cardId: string;
  species: BandeABananeMonkeySpecies;
  isJoker: boolean;
}

export type BandeABananeState = Record<string, never>;
