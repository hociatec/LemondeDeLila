import { freezeGameContent } from '../../../engine/sdk/public-api';
import type { WonderGood, WonderInventory, WonderPrices } from './types';

export const WONDER_GOODS: readonly WonderGood[] = [
  'gemmes',
  'potions',
  'reliques',
  'ingredients',
];

export const GOOD_LABELS: Readonly<Record<WonderGood, string>> = {
  gemmes: 'Gemmes',
  potions: 'Potions',
  reliques: 'Reliques',
  ingredients: 'Ingrédients',
};

export const INITIAL_PRICES: WonderPrices = {
  gemmes: 5,
  potions: 4,
  reliques: 7,
  ingredients: 3,
};

export const EMPTY_INVENTORY: WonderInventory = {
  gemmes: 0,
  potions: 0,
  reliques: 0,
  ingredients: 0,
};

export const MARKET_RULES = {
  startingCoins: 12,
  maxRounds: 6,
  protectCost: 2,
  rumorCost: 1,
} as const;

freezeGameContent(WONDER_GOODS);
freezeGameContent(GOOD_LABELS);
freezeGameContent(INITIAL_PRICES);
freezeGameContent(EMPTY_INVENTORY);
freezeGameContent(MARKET_RULES);
