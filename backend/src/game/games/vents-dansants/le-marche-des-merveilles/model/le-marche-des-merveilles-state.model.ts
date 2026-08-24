export type WonderGood = 'gemmes' | 'potions' | 'reliques' | 'ingredients';

export type WonderInventory = Record<WonderGood, number>;

export type WonderPrices = Record<WonderGood, number>;

export type LeMarcheDesMerveillesMetadata = {
  round: number;
  maxRounds: number;
  turnsTaken: number;
  prices: WonderPrices;
  coins: Record<number, number>;
  inventories: Record<number, WonderInventory>;
  protectedPlayers: Record<number, boolean>;
  lastMarketEvent: string | null;
  winnerId: number | null;
};
