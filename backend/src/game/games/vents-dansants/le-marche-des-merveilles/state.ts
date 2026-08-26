import type { PlayerMap } from '../../../core/application/public-api';

export type WonderGood = 'gemmes' | 'potions' | 'reliques' | 'ingredients';
export type WonderInventory = Record<WonderGood, number>;
export type WonderPrices = Record<WonderGood, number>;

export type WonderMarketState = Record<string, never>;

export type WonderMarketPlayerView = {
  turnsTaken: number;
  lastMarketEvent: {
    key: string;
    params: Record<string, unknown>;
    timestamp?: string;
  } | null;
  maxRounds: number;
  protectedPlayers: PlayerMap<boolean>;
};
