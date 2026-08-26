import type { BandeABananeMonkeySpecies } from './content';
import type { PlayerMap } from '../../../core/application/public-api';

export interface BandeABananeTroopEntry {
  cardId: string;
  species: BandeABananeMonkeySpecies;
  isJoker: boolean;
}

export type BandeABananeState = Record<string, never>;

export type BandeABananePlayerView = {
  troops: PlayerMap<BandeABananeTroopEntry[]>;
};
