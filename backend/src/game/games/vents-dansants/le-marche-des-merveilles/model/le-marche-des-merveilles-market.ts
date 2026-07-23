import type { WonderGood, WonderInventory, WonderPrices } from './le-marche-des-merveilles-state.entity';

export const WONDER_GOODS: WonderGood[] = [
  'gemmes',
  'potions',
  'reliques',
  'ingredients',
];

export const GOOD_LABELS: Record<WonderGood, string> = {
  gemmes: 'Gemmes',
  potions: 'Potions',
  reliques: 'Reliques',
  ingredients: 'Ingredients',
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

export const STARTING_COINS = 12;
export const MAX_ROUNDS = 6;
export const PROTECT_COST = 2;
export const RUMOR_COST = 1;

export function clampPrice(value: number): number {
  return Math.max(1, Math.min(10, Math.trunc(value)));
}

export function copyInventory(source?: Partial<WonderInventory>): WonderInventory {
  return {
    gemmes: Number(source?.gemmes ?? 0),
    potions: Number(source?.potions ?? 0),
    reliques: Number(source?.reliques ?? 0),
    ingredients: Number(source?.ingredients ?? 0),
  };
}

export function inventoryValue(
  inventory: WonderInventory | undefined,
  prices: WonderPrices,
): number {
  const safe = copyInventory(inventory);
  return WONDER_GOODS.reduce(
    (total, good) => total + safe[good] * (prices[good] ?? 0),
    0,
  );
}
