export type WonderGood = 'gemmes' | 'potions' | 'reliques' | 'ingredients';
export type WonderInventory = Record<WonderGood, number>;
export type WonderPrices = Record<WonderGood, number>;

export type WonderMarketState =
  import('../../../engine/sdk/public-api').NoGameState;
