export type BandeABananeMonkeySpecies =
  'capucin' | 'mandrill' | 'gibbon' | 'babouin' | 'macaque';

export interface BandeABananeTroopEntry {
  cardId: string;
  species: BandeABananeMonkeySpecies;
  isJoker: boolean;
}

export type BandeABananeState =
  import('../../../engine/sdk/public-api').NoGameState;
